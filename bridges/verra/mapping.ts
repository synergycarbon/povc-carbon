/**
 * SC Credit ↔ Verra Serial Number Mapping
 *
 * Bidirectional mapping between SynergyCarbon credit_ids and Verra VCU serial
 * numbers. Implements the bridge state machine that enforces BRIDGE_LOCKED
 * semantics to prevent double-counting across registries.
 *
 * State machine:
 *   PENDING → SUBMITTED → LISTED → RETIRED
 *                ↓                    ↑
 *             REJECTED          (on either registry)
 *
 * A credit in SUBMITTED or LISTED state is BRIDGE_LOCKED on SynergyCarbon —
 * it cannot be transferred or retired until the lock is released (rejection
 * or retirement propagation).
 */

// ---------------------------------------------------------------------------
// Bridge States
// ---------------------------------------------------------------------------

export type BridgeState =
  | 'PENDING'
  | 'SUBMITTED'
  | 'LISTED'
  | 'RETIRED'
  | 'REJECTED';

const VALID_TRANSITIONS: Record<BridgeState, BridgeState[]> = {
  PENDING:   ['SUBMITTED'],
  SUBMITTED: ['LISTED', 'REJECTED'],
  LISTED:    ['RETIRED'],
  REJECTED:  ['PENDING'],
  RETIRED:   [],
};

export function is_bridge_locked(state: BridgeState): boolean {
  return state === 'SUBMITTED' || state === 'LISTED';
}

// ---------------------------------------------------------------------------
// Mapping Record
// ---------------------------------------------------------------------------

export interface BridgeMappingRecord {
  credit_id: string;
  sc_serial_number: string;
  verra_serial: string | null;
  verra_project_id: string | null;
  state: BridgeState;
  submitted_at: number | null;
  listed_at: number | null;
  retired_at: number | null;
  rejected_at: number | null;
  rejection_reason: string | null;
  last_sync_at: number;
  attestation_hash: string;
  methodology_id: string;
  vintage_year: number;
  tonnes_co2e: number;
}

// ---------------------------------------------------------------------------
// Mapping Store
// ---------------------------------------------------------------------------

export class BridgeMappingStore {
  private by_credit_id = new Map<string, BridgeMappingRecord>();
  private by_verra_serial = new Map<string, BridgeMappingRecord>();

  create(params: {
    credit_id: string;
    sc_serial_number: string;
    attestation_hash: string;
    methodology_id: string;
    vintage_year: number;
    tonnes_co2e: number;
  }): BridgeMappingRecord {
    if (this.by_credit_id.has(params.credit_id)) {
      throw new BridgeMappingError(`Mapping already exists for credit ${params.credit_id}`);
    }

    const record: BridgeMappingRecord = {
      credit_id: params.credit_id,
      sc_serial_number: params.sc_serial_number,
      verra_serial: null,
      verra_project_id: null,
      state: 'PENDING',
      submitted_at: null,
      listed_at: null,
      retired_at: null,
      rejected_at: null,
      rejection_reason: null,
      last_sync_at: Date.now(),
      attestation_hash: params.attestation_hash,
      methodology_id: params.methodology_id,
      vintage_year: params.vintage_year,
      tonnes_co2e: params.tonnes_co2e,
    };

    this.by_credit_id.set(params.credit_id, record);
    return record;
  }

  // ── Lookups ───────────────────────────────────────────────────────────

  get_by_credit_id(credit_id: string): BridgeMappingRecord | undefined {
    return this.by_credit_id.get(credit_id);
  }

  get_by_verra_serial(verra_serial: string): BridgeMappingRecord | undefined {
    return this.by_verra_serial.get(verra_serial);
  }

  get_all_by_state(state: BridgeState): BridgeMappingRecord[] {
    return Array.from(this.by_credit_id.values()).filter((r) => r.state === state);
  }

  get_locked(): BridgeMappingRecord[] {
    return Array.from(this.by_credit_id.values()).filter((r) => is_bridge_locked(r.state));
  }

  // ── State Transitions ─────────────────────────────────────────────────

  transition(credit_id: string, to: BridgeState, meta?: TransitionMeta): BridgeMappingRecord {
    const record = this.by_credit_id.get(credit_id);
    if (!record) {
      throw new BridgeMappingError(`No mapping for credit ${credit_id}`);
    }

    const allowed = VALID_TRANSITIONS[record.state];
    if (!allowed.includes(to)) {
      throw new BridgeStateTransitionError(record.state, to, credit_id);
    }

    record.state = to;
    record.last_sync_at = Date.now();

    switch (to) {
      case 'SUBMITTED':
        record.submitted_at = Date.now();
        break;
      case 'LISTED':
        record.listed_at = Date.now();
        if (meta?.verra_serial) {
          record.verra_serial = meta.verra_serial;
          this.by_verra_serial.set(meta.verra_serial, record);
        }
        if (meta?.verra_project_id) {
          record.verra_project_id = meta.verra_project_id;
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

  // ── Bulk Operations ───────────────────────────────────────────────────

  pending_count(): number {
    return this.get_all_by_state('PENDING').length;
  }

  submitted_count(): number {
    return this.get_all_by_state('SUBMITTED').length;
  }

  listed_count(): number {
    return this.get_all_by_state('LISTED').length;
  }

  size(): number {
    return this.by_credit_id.size;
  }
}

// ---------------------------------------------------------------------------
// Transition Metadata
// ---------------------------------------------------------------------------

export interface TransitionMeta {
  verra_serial?: string;
  verra_project_id?: string;
  rejection_reason?: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class BridgeMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BridgeMappingError';
  }
}

export class BridgeStateTransitionError extends Error {
  constructor(
    public readonly from: BridgeState,
    public readonly to: BridgeState,
    public readonly credit_id: string,
  ) {
    super(`Invalid bridge state transition ${from} → ${to} for credit ${credit_id}`);
    this.name = 'BridgeStateTransitionError';
  }
}
