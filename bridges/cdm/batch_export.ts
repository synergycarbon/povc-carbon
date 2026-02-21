/**
 * CDM Batch Export — SC Credit Registration on CDM
 *
 * Bulk export/registration of SynergyCarbon credits onto the CDM registry.
 * Collects eligible SC credits, converts to CDM format, submits via the
 * CDM SOAP bulk registration endpoint, and updates mapping state.
 *
 * Export flow:
 *   1. Collect SC credits in PENDING state targeting CDM
 *   2. Validate each credit is not BRIDGE_LOCKED by another bridge
 *   3. Transition each to SUBMITTED (acquires BRIDGE_LOCK)
 *   4. Batch-submit to CDM via SOAP API
 *   5. Process CDM response — update mappings with CDM serials or rejections
 *   6. Publish export events for downstream consumers
 */

import {
  type CdmClient,
  type CdmCreditRegistration,
  type CdmBulkRegistrationResponse,
} from './client';
import { CdmMappingStore, type CdmMappingRecord } from './mapping';

// ---------------------------------------------------------------------------
// Export Configuration
// ---------------------------------------------------------------------------

export interface BatchExportConfig {
  batch_size: number;
  max_retries_per_credit: number;
  project_name_prefix: string;
  default_host_country: string;
}

const DEFAULT_EXPORT_CONFIG: BatchExportConfig = {
  batch_size: 50,
  max_retries_per_credit: 3,
  project_name_prefix: 'SynergyCarbon',
  default_host_country: 'USA',
};

// ---------------------------------------------------------------------------
// Export Result Types
// ---------------------------------------------------------------------------

export interface BatchExportResult {
  batch_id: string;
  total_submitted: number;
  accepted: number;
  rejected: number;
  skipped_locked: number;
  skipped_retry_exceeded: number;
  results: ExportedCreditRecord[];
  errors: ExportError[];
  started_at: number;
  completed_at: number;
}

export interface ExportedCreditRecord {
  credit_id: string;
  sc_serial: string;
  cdm_serial: string;
  cdm_project_ref: string;
  status: 'pending_review' | 'registered' | 'rejected';
  transaction_id: string;
}

export interface ExportError {
  credit_id: string;
  error: string;
}

// ---------------------------------------------------------------------------
// Bridge Lock Checker (cross-bridge coordination)
// ---------------------------------------------------------------------------

export interface BridgeLockChecker {
  is_locked(credit_id: string): boolean;
  locked_by(credit_id: string): string | null;
}

// ---------------------------------------------------------------------------
// Batch Exporter
// ---------------------------------------------------------------------------

export class CdmBatchExporter {
  private readonly client: CdmClient;
  private readonly store: CdmMappingStore;
  private readonly config: BatchExportConfig;
  private readonly lock_checker: BridgeLockChecker | null;

  constructor(
    client: CdmClient,
    store: CdmMappingStore,
    config?: Partial<BatchExportConfig>,
    lock_checker?: BridgeLockChecker,
  ) {
    this.client = client;
    this.store = store;
    this.config = { ...DEFAULT_EXPORT_CONFIG, ...config };
    this.lock_checker = lock_checker ?? null;
  }

  /**
   * Export all PENDING credits to CDM in batches.
   */
  async export_pending(): Promise<BatchExportResult> {
    const pending = this.store.get_all_by_state('PENDING');
    return this.export_credits(pending);
  }

  /**
   * Export a specific list of credits to CDM.
   */
  async export_credits(credits: CdmMappingRecord[]): Promise<BatchExportResult> {
    const batch_id = generate_batch_id();
    const started_at = Date.now();
    const all_results: ExportedCreditRecord[] = [];
    const all_errors: ExportError[] = [];
    let skipped_locked = 0;
    let skipped_retry_exceeded = 0;
    let total_accepted = 0;
    let total_rejected = 0;

    const eligible: CdmMappingRecord[] = [];

    for (const credit of credits) {
      if (this.lock_checker && this.lock_checker.is_locked(credit.credit_id)) {
        const locked_by = this.lock_checker.locked_by(credit.credit_id);
        all_errors.push({
          credit_id: credit.credit_id,
          error: `BRIDGE_LOCKED by ${locked_by ?? 'unknown bridge'} — cannot submit to CDM`,
        });
        skipped_locked++;
        continue;
      }

      if (credit.retry_count >= this.config.max_retries_per_credit) {
        skipped_retry_exceeded++;
        continue;
      }

      eligible.push(credit);
    }

    for (let i = 0; i < eligible.length; i += this.config.batch_size) {
      const batch = eligible.slice(i, i + this.config.batch_size);

      for (const record of batch) {
        try {
          this.store.transition(record.credit_id, 'SUBMITTED');
        } catch (err) {
          all_errors.push({
            credit_id: record.credit_id,
            error: `Failed to transition to SUBMITTED: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }

      try {
        const registrations = batch.map((r) => build_cdm_registration(r, this.config));
        const response = await this.client.register_batch(registrations);

        const { results, errors, accepted, rejected } = process_batch_response(
          batch,
          response,
          this.store,
        );

        all_results.push(...results);
        all_errors.push(...errors);
        total_accepted += accepted;
        total_rejected += rejected;
      } catch (err) {
        for (const record of batch) {
          this.store.record_error(
            record.credit_id,
            err instanceof Error ? err.message : String(err),
          );
          all_errors.push({
            credit_id: record.credit_id,
            error: `Batch submission failed: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    }

    return {
      batch_id,
      total_submitted: eligible.length,
      accepted: total_accepted,
      rejected: total_rejected,
      skipped_locked,
      skipped_retry_exceeded,
      results: all_results,
      errors: all_errors,
      started_at,
      completed_at: Date.now(),
    };
  }

  /**
   * Re-export a single credit that was previously rejected.
   */
  async retry_single(credit_id: string): Promise<ExportedCreditRecord> {
    const record = this.store.get_by_credit_id(credit_id);
    if (!record) {
      throw new Error(`No CDM mapping found for credit ${credit_id}`);
    }

    if (record.state !== 'REJECTED' && record.state !== 'PENDING') {
      throw new Error(`Credit ${credit_id} is in ${record.state} state — cannot re-export`);
    }

    if (this.lock_checker && this.lock_checker.is_locked(credit_id)) {
      throw new Error(`Credit ${credit_id} is BRIDGE_LOCKED — cannot submit to CDM`);
    }

    if (record.state === 'REJECTED') {
      this.store.transition(credit_id, 'PENDING');
    }
    this.store.transition(credit_id, 'SUBMITTED');

    const registration = build_cdm_registration(record, this.config);
    const response = await this.client.register_credit(registration);

    if (response.status === 'rejected') {
      this.store.transition(credit_id, 'REJECTED', {
        rejection_reason: `CDM rejected: ${response.cdm_serial}`,
      });
      throw new Error(`CDM rejected credit ${credit_id}`);
    }

    this.store.transition(credit_id, 'REGISTERED', {
      cdm_serial: response.cdm_serial,
      cdm_project_ref: response.project_ref,
    });

    return {
      credit_id,
      sc_serial: record.sc_serial_number,
      cdm_serial: response.cdm_serial,
      cdm_project_ref: response.project_ref,
      status: response.status,
      transaction_id: response.transaction_id,
    };
  }
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

function build_cdm_registration(
  record: CdmMappingRecord,
  config: BatchExportConfig,
): CdmCreditRegistration {
  return {
    project_ref: record.cdm_project_ref ?? `${config.project_name_prefix}-${record.vintage_year}`,
    cpa_id: record.cpa_id ?? '',
    host_country: record.host_country || config.default_host_country,
    methodology_ref: record.methodology_ref,
    vintage_year: record.vintage_year,
    tonnes_co2e: record.tonnes_co2e,
    monitoring_report_ref: record.attestation_hash,
    sc_credit_id: record.credit_id,
    sc_serial_number: record.sc_serial_number,
    sc_attestation_hash: record.attestation_hash,
  };
}

function process_batch_response(
  batch: CdmMappingRecord[],
  response: CdmBulkRegistrationResponse,
  store: CdmMappingStore,
): {
  results: ExportedCreditRecord[];
  errors: ExportError[];
  accepted: number;
  rejected: number;
} {
  const results: ExportedCreditRecord[] = [];
  const errors: ExportError[] = [];
  let accepted = 0;
  let rejected = 0;

  for (let i = 0; i < response.results.length && i < batch.length; i++) {
    const cdm_result = response.results[i];
    const record = batch[i];

    if (cdm_result.status === 'rejected') {
      try {
        store.transition(record.credit_id, 'REJECTED', {
          rejection_reason: `CDM rejected: transaction ${cdm_result.transaction_id}`,
        });
      } catch {
        // Already transitioned
      }
      errors.push({
        credit_id: record.credit_id,
        error: `CDM rejected: transaction ${cdm_result.transaction_id}`,
      });
      rejected++;
    } else {
      try {
        store.transition(record.credit_id, 'REGISTERED', {
          cdm_serial: cdm_result.cdm_serial,
          cdm_project_ref: cdm_result.project_ref,
        });
      } catch {
        // Already transitioned
      }
      results.push({
        credit_id: record.credit_id,
        sc_serial: record.sc_serial_number,
        cdm_serial: cdm_result.cdm_serial,
        cdm_project_ref: cdm_result.project_ref,
        status: cdm_result.status,
        transaction_id: cdm_result.transaction_id,
      });
      accepted++;
    }
  }

  return { results, errors, accepted, rejected };
}

function generate_batch_id(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `cdm-export-${timestamp}-${random}`;
}
