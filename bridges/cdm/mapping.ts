/**
 * SC Credit <-> CDM Serial Number Mapping
 *
 * Bidirectional mapping between SynergyCarbon credit_ids and CDM CER serial
 * numbers. Implements the bridge state machine that enforces BRIDGE_LOCKED
 * semantics to prevent double-counting across registries.
 *
 * CDM uses a simpler state model than Verra/GS because its SOAP API is
 * poll-based (no webhooks) — status changes are discovered during sync.
 *
 * State machine:
 *   PENDING → SUBMITTED → REGISTERED → RETIRED
 *                ↓                        ↑
 *             REJECTED             (on either registry)
 *
 * A credit in SUBMITTED or REGISTERED state is BRIDGE_LOCKED on SynergyCarbon —
 * it cannot be transferred or retired until the lock is released (rejection
 * or retirement propagation).
 */

// ---------------------------------------------------------------------------
// Bridge States
// ---------------------------------------------------------------------------

export type CdmBridgeState =
  | 'PENDING'
  | 'SUBMITTED'
  | 'REGISTERED'
  | 'RETIRED'
  | 'REJECTED';

const VALID_TRANSITIONS: Record<CdmBridgeState, CdmBridgeState[]> = {
  PENDING:    ['SUBMITTED'],
  SUBMITTED:  ['REGISTERED', 'REJECTED'],
  REGISTERED: ['RETIRED'],
  REJECTED:   ['PENDING'],
  RETIRED:    [],
};

const LOCKED_STATES = new Set<CdmBridgeState>(['SUBMITTED', 'REGISTERED']);

export function is_bridge_locked(state: CdmBridgeState): boolean {
  return LOCKED_STATES.has(state);
}

export function is_valid_transition(from: CdmBridgeState, to: CdmBridgeState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function cdm_status_to_bridge_state(cdm_status: string): CdmBridgeState | null {
  switch (cdm_status) {
    case 'pending_review':
      return 'SUBMITTED';
    case 'registered':
    case 'active':
      return 'REGISTERED';
    case 'retired':
      return 'RETIRED';
    case 'cancelled':
    case 'suspended':
    case 'rejected':
      return 'REJECTED';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Mapping Record
// ---------------------------------------------------------------------------

export interface CdmMappingRecord {
  credit_id: string;
  sc_serial_number: string;
  cdm_serial: string | null;
  cdm_project_ref: string | null;
  cpa_id: string | null;
  state: CdmBridgeState;
  bridge_locked: boolean;
  submitted_at: number | null;
  registered_at: number | null;
  retired_at: number | null;
  rejected_at: number | null;
  rejection_reason: string | null;
  last_sync_at: number;
  attestation_hash: string;
  methodology_ref: string;
  vintage_year: number;
  tonnes_co2e: number;
  host_country: string;
  import_batch_id: string | null;
  retry_count: number;
  last_error: string | null;
}

// ---------------------------------------------------------------------------
// Transition Metadata
// ---------------------------------------------------------------------------

export interface CdmTransitionMeta {
  cdm_serial?: string;
  cdm_project_ref?: string;
  cpa_id?: string;
  rejection_reason?: string;
  transaction_id?: string;
}

// ---------------------------------------------------------------------------
// Mapping Store
// ---------------------------------------------------------------------------

export class CdmMappingStore {
  private by_credit_id = new Map<string, CdmMappingRecord>();
  private by_cdm_serial = new Map<string, CdmMappingRecord>();

  create(params: {
    credit_id: string;
    sc_serial_number: string;
    attestation_hash: string;
    methodology_ref: string;
    vintage_year: number;
    tonnes_co2e: number;
    host_country: string;
    import_batch_id?: string;
  }): CdmMappingRecord {
    if (this.by_credit_id.has(params.credit_id)) {
      throw new CdmMappingError(`Mapping already exists for credit ${params.credit_id}`);
    }

    const record: CdmMappingRecord = {
      credit_id: params.credit_id,
      sc_serial_number: params.sc_serial_number,
      cdm_serial: null,
      cdm_project_ref: null,
      cpa_id: null,
      state: 'PENDING',
      bridge_locked: false,
      submitted_at: null,
      registered_at: null,
      retired_at: null,
      rejected_at: null,
      rejection_reason: null,
      last_sync_at: Date.now(),
      attestation_hash: params.attestation_hash,
      methodology_ref: params.methodology_ref,
      vintage_year: params.vintage_year,
      tonnes_co2e: params.tonnes_co2e,
      host_country: params.host_country,
      import_batch_id: params.import_batch_id ?? null,
      retry_count: 0,
      last_error: null,
    };

    this.by_credit_id.set(params.credit_id, record);
    return record;
  }

  // ── Bulk Create (for batch import) ──────────────────────────────────

  create_from_cdm(params: {
    credit_id: string;
    sc_serial_number: string;
    cdm_serial: string;
    cdm_project_ref: string;
    cpa_id: string;
    attestation_hash: string;
    methodology_ref: string;
    vintage_year: number;
    tonnes_co2e: number;
    host_country: string;
    import_batch_id: string;
  }): CdmMappingRecord {
    if (this.by_credit_id.has(params.credit_id)) {
      throw new CdmMappingError(`Mapping already exists for credit ${params.credit_id}`);
    }

    const record: CdmMappingRecord = {
      credit_id: params.credit_id,
      sc_serial_number: params.sc_serial_number,
      cdm_serial: params.cdm_serial,
      cdm_project_ref: params.cdm_project_ref,
      cpa_id: params.cpa_id,
      state: 'REGISTERED',
      bridge_locked: true,
      submitted_at: Date.now(),
      registered_at: Date.now(),
      retired_at: null,
      rejected_at: null,
      rejection_reason: null,
      last_sync_at: Date.now(),
      attestation_hash: params.attestation_hash,
      methodology_ref: params.methodology_ref,
      vintage_year: params.vintage_year,
      tonnes_co2e: params.tonnes_co2e,
      host_country: params.host_country,
      import_batch_id: params.import_batch_id,
      retry_count: 0,
      last_error: null,
    };

    this.by_credit_id.set(params.credit_id, record);
    this.by_cdm_serial.set(params.cdm_serial, record);
    return record;
  }

  // ── Lookups ─────────────────────────────────────────────────────────

  get_by_credit_id(credit_id: string): CdmMappingRecord | undefined {
    return this.by_credit_id.get(credit_id);
  }

  get_by_cdm_serial(cdm_serial: string): CdmMappingRecord | undefined {
    return this.by_cdm_serial.get(cdm_serial);
  }

  get_all_by_state(state: CdmBridgeState): CdmMappingRecord[] {
    return Array.from(this.by_credit_id.values()).filter((r) => r.state === state);
  }

  get_locked(): CdmMappingRecord[] {
    return Array.from(this.by_credit_id.values()).filter((r) => r.bridge_locked);
  }

  get_by_batch(batch_id: string): CdmMappingRecord[] {
    return Array.from(this.by_credit_id.values()).filter((r) => r.import_batch_id === batch_id);
  }

  // ── State Transitions ───────────────────────────────────────────────

  transition(credit_id: string, to: CdmBridgeState, meta?: CdmTransitionMeta): CdmMappingRecord {
    const record = this.by_credit_id.get(credit_id);
    if (!record) {
      throw new CdmMappingError(`No mapping for credit ${credit_id}`);
    }

    if (!is_valid_transition(record.state, to)) {
      throw new CdmStateTransitionError(record.state, to, credit_id);
    }

    record.state = to;
    record.bridge_locked = is_bridge_locked(to);
    record.last_sync_at = Date.now();

    switch (to) {
      case 'SUBMITTED':
        record.submitted_at = Date.now();
        break;
      case 'REGISTERED':
        record.registered_at = Date.now();
        if (meta?.cdm_serial) {
          record.cdm_serial = meta.cdm_serial;
          this.by_cdm_serial.set(meta.cdm_serial, record);
        }
        if (meta?.cdm_project_ref) {
          record.cdm_project_ref = meta.cdm_project_ref;
        }
        if (meta?.cpa_id) {
          record.cpa_id = meta.cpa_id;
        }
        break;
      case 'RETIRED':
        record.retired_at = Date.now();
        break;
      case 'REJECTED':
        record.rejected_at = Date.now();
        record.rejection_reason = meta?.rejection_reason ?? null;
        break;
    }

    return record;
  }

  // ── Error Recording ─────────────────────────────────────────────────

  record_error(credit_id: string, error: string): void {
    const record = this.by_credit_id.get(credit_id);
    if (!record) return;

    record.last_error = error;
    record.retry_count += 1;
    record.last_sync_at = Date.now();
  }

  // ── Stats ───────────────────────────────────────────────────────────

  pending_count(): number {
    return this.get_all_by_state('PENDING').length;
  }

  submitted_count(): number {
    return this.get_all_by_state('SUBMITTED').length;
  }

  registered_count(): number {
    return this.get_all_by_state('REGISTERED').length;
  }

  size(): number {
    return this.by_credit_id.size;
  }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CdmMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CdmMappingError';
  }
}

export class CdmStateTransitionError extends Error {
  constructor(
    public readonly from: CdmBridgeState,
    public readonly to: CdmBridgeState,
    public readonly credit_id: string,
  ) {
    super(`Invalid CDM bridge state transition ${from} → ${to} for credit ${credit_id}`);
    this.name = 'CdmStateTransitionError';
  }
}
