/**
 * CDM Batch Import — Historical Credit Migration
 *
 * Bulk import of legacy CDM CER credits into SynergyCarbon. Fetches pages
 * of credits from the CDM SOAP API, converts them to SC credit format, and
 * creates mapping records with REGISTERED + BRIDGE_LOCKED state (since the
 * credits are already live on CDM).
 *
 * Import flow:
 *   1. Query CDM registry for credits matching project/vintage criteria
 *   2. Filter out credits already mapped in SC
 *   3. Generate SC credit_id and serial for each imported credit
 *   4. Create mapping records in REGISTERED state (already live on CDM)
 *   5. Publish import events for downstream consumers
 */

import { type CdmClient, type CdmBulkQueryParams, type CdmStatusResponse } from './client';
import { CdmMappingStore, type CdmMappingRecord } from './mapping';

// ---------------------------------------------------------------------------
// Import Configuration
// ---------------------------------------------------------------------------

export interface BatchImportConfig {
  page_size: number;
  max_credits_per_batch: number;
  dry_run: boolean;
  skip_duplicates: boolean;
  sc_serial_prefix: string;
}

const DEFAULT_IMPORT_CONFIG: BatchImportConfig = {
  page_size: 100,
  max_credits_per_batch: 10_000,
  dry_run: false,
  skip_duplicates: true,
  sc_serial_prefix: 'SC-CDM',
};

// ---------------------------------------------------------------------------
// Import Result Types
// ---------------------------------------------------------------------------

export interface BatchImportResult {
  batch_id: string;
  total_queried: number;
  imported: number;
  skipped_duplicates: number;
  skipped_errors: number;
  records: ImportedCreditRecord[];
  errors: ImportError[];
  started_at: number;
  completed_at: number;
}

export interface ImportedCreditRecord {
  credit_id: string;
  sc_serial: string;
  cdm_serial: string;
  cdm_project_ref: string;
  cpa_id: string;
  vintage_year: number;
  tonnes_co2e: number;
}

export interface ImportError {
  cdm_serial: string;
  error: string;
}

// ---------------------------------------------------------------------------
// Legacy Format Conversion
// ---------------------------------------------------------------------------

export interface CdmLegacyCredit {
  serial_number: string;
  project_activity_ref: string;
  component_project_activity_id: string;
  host_party: string;
  crediting_period_start: string;
  crediting_period_end: string;
  methodology: string;
  vintage: number;
  quantity_tco2e: number;
  status: string;
  issuance_date: string;
}

export function convert_legacy_credit(legacy: CdmLegacyCredit): {
  cdm_serial: string;
  project_ref: string;
  cpa_id: string;
  host_country: string;
  methodology_ref: string;
  vintage_year: number;
  tonnes_co2e: number;
} {
  return {
    cdm_serial: legacy.serial_number,
    project_ref: legacy.project_activity_ref,
    cpa_id: legacy.component_project_activity_id,
    host_country: normalize_host_country(legacy.host_party),
    methodology_ref: normalize_methodology(legacy.methodology),
    vintage_year: legacy.vintage,
    tonnes_co2e: legacy.quantity_tco2e,
  };
}

// ---------------------------------------------------------------------------
// Batch Importer
// ---------------------------------------------------------------------------

export class CdmBatchImporter {
  private readonly client: CdmClient;
  private readonly store: CdmMappingStore;
  private readonly config: BatchImportConfig;

  constructor(client: CdmClient, store: CdmMappingStore, config?: Partial<BatchImportConfig>) {
    this.client = client;
    this.store = store;
    this.config = { ...DEFAULT_IMPORT_CONFIG, ...config };
  }

  /**
   * Import credits from CDM registry matching the given query criteria.
   * Pages through the CDM SOAP API until all matching credits are fetched
   * or max_credits_per_batch is reached.
   */
  async import_from_query(query: CdmBulkQueryParams): Promise<BatchImportResult> {
    const batch_id = generate_batch_id();
    const started_at = Date.now();
    const records: ImportedCreditRecord[] = [];
    const errors: ImportError[] = [];
    let skipped_duplicates = 0;
    let total_queried = 0;

    const effective_query: CdmBulkQueryParams = {
      ...query,
      page_size: Math.min(query.page_size || this.config.page_size, this.config.page_size),
    };

    let page_token: string | undefined;

    while (records.length + skipped_duplicates < this.config.max_credits_per_batch) {
      if (page_token) {
        effective_query.page_token = page_token;
      }

      const page = await this.client.bulk_query(effective_query);
      total_queried += page.credits.length;

      for (const cdm_credit of page.credits) {
        if (records.length >= this.config.max_credits_per_batch) break;

        const existing = this.store.get_by_cdm_serial(cdm_credit.cdm_serial);
        if (existing) {
          if (this.config.skip_duplicates) {
            skipped_duplicates++;
            continue;
          }
          errors.push({
            cdm_serial: cdm_credit.cdm_serial,
            error: `Already mapped as ${existing.credit_id}`,
          });
          continue;
        }

        try {
          const imported = this.import_single_credit(cdm_credit, batch_id);
          records.push(imported);
        } catch (err) {
          errors.push({
            cdm_serial: cdm_credit.cdm_serial,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      page_token = page.next_page_token;
      if (!page_token || page.credits.length === 0) break;
    }

    return {
      batch_id,
      total_queried,
      imported: records.length,
      skipped_duplicates,
      skipped_errors: errors.length,
      records,
      errors,
      started_at,
      completed_at: Date.now(),
    };
  }

  /**
   * Import from a pre-parsed list of legacy CDM credits (e.g., from CSV/XML dump).
   */
  import_legacy_batch(credits: CdmLegacyCredit[]): BatchImportResult {
    const batch_id = generate_batch_id();
    const started_at = Date.now();
    const records: ImportedCreditRecord[] = [];
    const errors: ImportError[] = [];
    let skipped_duplicates = 0;

    for (const legacy of credits) {
      const converted = convert_legacy_credit(legacy);

      const existing = this.store.get_by_cdm_serial(converted.cdm_serial);
      if (existing) {
        if (this.config.skip_duplicates) {
          skipped_duplicates++;
          continue;
        }
        errors.push({
          cdm_serial: converted.cdm_serial,
          error: `Already mapped as ${existing.credit_id}`,
        });
        continue;
      }

      try {
        const credit_id = generate_credit_id(converted.cdm_serial, converted.vintage_year);
        const sc_serial = generate_sc_serial(
          this.config.sc_serial_prefix,
          converted.vintage_year,
          converted.cdm_serial,
        );

        if (!this.config.dry_run) {
          this.store.create_from_cdm({
            credit_id,
            sc_serial_number: sc_serial,
            cdm_serial: converted.cdm_serial,
            cdm_project_ref: converted.project_ref,
            cpa_id: converted.cpa_id,
            attestation_hash: compute_attestation_hash(converted.cdm_serial, converted.project_ref),
            methodology_ref: converted.methodology_ref,
            vintage_year: converted.vintage_year,
            tonnes_co2e: converted.tonnes_co2e,
            host_country: converted.host_country,
            import_batch_id: batch_id,
          });
        }

        records.push({
          credit_id,
          sc_serial,
          cdm_serial: converted.cdm_serial,
          cdm_project_ref: converted.project_ref,
          cpa_id: converted.cpa_id,
          vintage_year: converted.vintage_year,
          tonnes_co2e: converted.tonnes_co2e,
        });
      } catch (err) {
        errors.push({
          cdm_serial: converted.cdm_serial,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      batch_id,
      total_queried: credits.length,
      imported: records.length,
      skipped_duplicates,
      skipped_errors: errors.length,
      records,
      errors,
      started_at,
      completed_at: Date.now(),
    };
  }

  private import_single_credit(cdm_credit: CdmStatusResponse, batch_id: string): ImportedCreditRecord {
    const credit_id = generate_credit_id(cdm_credit.cdm_serial, cdm_credit.vintage_year);
    const sc_serial = generate_sc_serial(
      this.config.sc_serial_prefix,
      cdm_credit.vintage_year,
      cdm_credit.cdm_serial,
    );

    if (!this.config.dry_run) {
      this.store.create_from_cdm({
        credit_id,
        sc_serial_number: sc_serial,
        cdm_serial: cdm_credit.cdm_serial,
        cdm_project_ref: cdm_credit.project_ref,
        cpa_id: cdm_credit.cpa_id,
        attestation_hash: compute_attestation_hash(cdm_credit.cdm_serial, cdm_credit.project_ref),
        methodology_ref: `CDM-${cdm_credit.vintage_year}`,
        vintage_year: cdm_credit.vintage_year,
        tonnes_co2e: cdm_credit.tonnes_co2e,
        host_country: '',
        import_batch_id: batch_id,
      });
    }

    return {
      credit_id,
      sc_serial,
      cdm_serial: cdm_credit.cdm_serial,
      cdm_project_ref: cdm_credit.project_ref,
      cpa_id: cdm_credit.cpa_id,
      vintage_year: cdm_credit.vintage_year,
      tonnes_co2e: cdm_credit.tonnes_co2e,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generate_batch_id(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `cdm-import-${timestamp}-${random}`;
}

function generate_credit_id(cdm_serial: string, vintage_year: number): string {
  const hash_input = `${cdm_serial}:${vintage_year}:${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < hash_input.length; i++) {
    const char = hash_input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `SC-CDM-${vintage_year}-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

function generate_sc_serial(prefix: string, vintage_year: number, cdm_serial: string): string {
  const cleaned = cdm_serial.replace(/[^a-zA-Z0-9]/g, '-');
  return `${prefix}-${vintage_year}-${cleaned}`;
}

function compute_attestation_hash(cdm_serial: string, project_ref: string): string {
  const input = `${cdm_serial}:${project_ref}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) | 0;
  }
  return `0x${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function normalize_host_country(host_party: string): string {
  return host_party.trim().toUpperCase().substring(0, 3);
}

function normalize_methodology(methodology: string): string {
  return methodology.replace(/\s+/g, '-').toUpperCase();
}
