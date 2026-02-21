/**
 * CDM Batch Export — SC Credit Registration on CDM
 *
 * Bulk export/registration of SynergyCarbon credits onto the CDM registry.
 * Handles conversion from SC internal representation to CDM XML format,
 * batch submission via SOAP API, and mapping state transitions.
 *
 * Flow:
 *   1. Collect SC credits by ID list
 *   2. Validate each credit is eligible for export (not already locked)
 *   3. Convert SC format → CDM registration request
 *   4. Submit batch to CDM via SOAP API
 *   5. Create/update bridge mappings (PENDING → SUBMITTED)
 *   6. Return export results with per-credit status
 */

import {
  type CDMClient,
  type CDMRegistrationRequest,
  type CDMRegistrationResponse,
  type CDMCreditType,
} from './client';
import {
  type CDMBridgeMappingStore,
  type CDMBridgeMappingRecord,
  is_bridge_locked,
} from './mapping';

// ---------------------------------------------------------------------------
// Export Types
// ---------------------------------------------------------------------------

export interface BatchExportConfig {
  batch_size: number;
  lock_on_submit: boolean;
}

const DEFAULT_EXPORT_CONFIG: BatchExportConfig = {
  batch_size: 50,
  lock_on_submit: true,
};

export interface ExportCreditInput {
  credit_id: string;
  sc_serial_number: string;
  attestation_hash: string;
  tonnes_co2e: number;
  vintage_year: number;
  project_name: string;
  project_location: string;
  methodology_ref: string;
  host_country: string;
  credit_type: CDMCreditType;
}

export interface ExportedCreditResult {
  credit_id: string;
  cdm_serial: string;
  status: 'submitted' | 'skipped_locked' | 'skipped_existing' | 'rejected' | 'error';
  transaction_id?: string;
  error?: string;
}

export interface BatchExportResult {
  batch_id: string;
  total_requested: number;
  submitted: number;
  skipped_locked: number;
  skipped_existing: number;
  rejected: number;
  errors: number;
  results: ExportedCreditResult[];
  started_at: number;
  completed_at: number;
}

// ---------------------------------------------------------------------------
// Batch Exporter
// ---------------------------------------------------------------------------

export class CDMBatchExporter {
  private readonly client: CDMClient;
  private readonly store: CDMBridgeMappingStore;

  constructor(client: CDMClient, store: CDMBridgeMappingStore) {
    this.client = client;
    this.store = store;
  }

  async export_credits(
    credits: ExportCreditInput[],
    config?: Partial<BatchExportConfig>,
  ): Promise<BatchExportResult> {
    const cfg = { ...DEFAULT_EXPORT_CONFIG, ...config };
    const batch_id = generate_export_batch_id();
    const started_at = Date.now();
    const all_results: ExportedCreditResult[] = [];

    const { eligible, skipped } = this.partition_eligible(credits);
    all_results.push(...skipped);

    for (let i = 0; i < eligible.length; i += cfg.batch_size) {
      const chunk = eligible.slice(i, i + cfg.batch_size);
      const chunk_results = await this.submit_chunk(chunk, cfg);
      all_results.push(...chunk_results);
    }

    return {
      batch_id,
      total_requested: credits.length,
      submitted: all_results.filter((r) => r.status === 'submitted').length,
      skipped_locked: all_results.filter((r) => r.status === 'skipped_locked').length,
      skipped_existing: all_results.filter((r) => r.status === 'skipped_existing').length,
      rejected: all_results.filter((r) => r.status === 'rejected').length,
      errors: all_results.filter((r) => r.status === 'error').length,
      results: all_results,
      started_at,
      completed_at: Date.now(),
    };
  }

  private partition_eligible(credits: ExportCreditInput[]): {
    eligible: ExportCreditInput[];
    skipped: ExportedCreditResult[];
  } {
    const eligible: ExportCreditInput[] = [];
    const skipped: ExportedCreditResult[] = [];

    for (const credit of credits) {
      const existing = this.store.get_by_credit_id(credit.credit_id);

      if (existing && is_bridge_locked(existing.state)) {
        skipped.push({
          credit_id: credit.credit_id,
          cdm_serial: existing.cdm_serial ?? '',
          status: 'skipped_locked',
          error: `Credit is BRIDGE_LOCKED in state ${existing.state}`,
        });
        continue;
      }

      if (existing && (existing.state === 'REGISTERED' || existing.state === 'RETIRED')) {
        skipped.push({
          credit_id: credit.credit_id,
          cdm_serial: existing.cdm_serial ?? '',
          status: 'skipped_existing',
          error: `Credit already ${existing.state} on CDM`,
        });
        continue;
      }

      eligible.push(credit);
    }

    return { eligible, skipped };
  }

  private async submit_chunk(
    credits: ExportCreditInput[],
    config: BatchExportConfig,
  ): Promise<ExportedCreditResult[]> {
    const registration_requests: CDMRegistrationRequest[] = credits.map((c) => ({
      sc_credit_id: c.credit_id,
      sc_serial_number: c.sc_serial_number,
      attestation_hash: c.attestation_hash,
      tonnes_co2e: c.tonnes_co2e,
      vintage_year: c.vintage_year,
      project_name: c.project_name,
      project_location: c.project_location,
      methodology_ref: c.methodology_ref,
      host_country: c.host_country,
      credit_type: c.credit_type,
    }));

    let responses: CDMRegistrationResponse[];
    try {
      responses = await this.client.register_batch(registration_requests);
    } catch (err) {
      return credits.map((c) => ({
        credit_id: c.credit_id,
        cdm_serial: '',
        status: 'error' as const,
        error: err instanceof Error ? err.message : String(err),
      }));
    }

    const results: ExportedCreditResult[] = [];

    for (let i = 0; i < credits.length; i++) {
      const credit = credits[i];
      const response = responses[i];

      if (!response || response.status === 'rejected') {
        results.push({
          credit_id: credit.credit_id,
          cdm_serial: response?.cdm_serial ?? '',
          status: 'rejected',
          transaction_id: response?.transaction_id,
        });
        continue;
      }

      try {
        const existing = this.store.get_by_credit_id(credit.credit_id);

        if (existing) {
          this.store.transition(credit.credit_id, 'SUBMITTED', {
            cdm_serial: response.cdm_serial,
            cdm_project_ref: response.project_ref,
          });
        } else {
          const record = this.store.create({
            credit_id: credit.credit_id,
            sc_serial_number: credit.sc_serial_number,
            attestation_hash: credit.attestation_hash,
            methodology_ref: credit.methodology_ref,
            vintage_year: credit.vintage_year,
            tonnes_co2e: credit.tonnes_co2e,
            credit_type: credit.credit_type,
            host_country: credit.host_country,
          });
          this.store.transition(credit.credit_id, 'SUBMITTED', {
            cdm_serial: response.cdm_serial,
            cdm_project_ref: response.project_ref,
          });
        }

        results.push({
          credit_id: credit.credit_id,
          cdm_serial: response.cdm_serial,
          status: 'submitted',
          transaction_id: response.transaction_id,
        });
      } catch (err) {
        results.push({
          credit_id: credit.credit_id,
          cdm_serial: response.cdm_serial,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generate_export_batch_id(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `CDM-EXPORT-${ts}-${rand}`;
}
