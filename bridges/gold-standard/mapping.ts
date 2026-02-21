/**
 * Gold Standard Bridge — Credit ID Mapping & State Machine
 *
 * Maps SC credit_id <-> Gold Standard VER serial numbers.
 * Manages the bridge state machine: PENDING -> SUBMITTED -> MIRRORED -> SYNCED.
 * Enforces BRIDGE_LOCKED semantics for double-count prevention (SC-SPEC-005 §4.5).
 */

export enum BridgeState {
  PENDING = 0,
  SUBMITTED = 1,
  MIRRORED = 2,
  SYNCED = 3,
  REJECTED = 4,
}

export interface MirrorMapping {
  creditId: string;
  gsSerial: string;
  attestationHash: string;
  state: BridgeState;
  bridgeLocked: boolean;
  createdAt: number;
  updatedAt: number;
  retryCount: number;
  lastError: string | null;
}

const VALID_TRANSITIONS: Record<BridgeState, BridgeState[]> = {
  [BridgeState.PENDING]: [BridgeState.SUBMITTED, BridgeState.REJECTED],
  [BridgeState.SUBMITTED]: [BridgeState.MIRRORED, BridgeState.REJECTED],
  [BridgeState.MIRRORED]: [BridgeState.SYNCED, BridgeState.REJECTED],
  [BridgeState.SYNCED]: [],
  [BridgeState.REJECTED]: [BridgeState.PENDING],
};

const LOCKED_STATES = new Set([
  BridgeState.PENDING,
  BridgeState.SUBMITTED,
  BridgeState.MIRRORED,
]);

export function isValidTransition(
  from: BridgeState,
  to: BridgeState
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isBridgeLocked(state: BridgeState): boolean {
  return LOCKED_STATES.has(state);
}

export function BridgeStateFromGSStatus(gsStatus: string): BridgeState {
  switch (gsStatus) {
    case "pending_review":
      return BridgeState.SUBMITTED;
    case "active":
      return BridgeState.MIRRORED;
    case "retired":
    case "verified":
      return BridgeState.SYNCED;
    case "rejected":
    case "cancelled":
      return BridgeState.REJECTED;
    default:
      return BridgeState.PENDING;
  }
}

export class MirrorMappingStore {
  private byCreditId: Map<string, MirrorMapping> = new Map();
  private byGsSerial: Map<string, MirrorMapping> = new Map();

  create(
    creditId: string,
    gsSerial: string,
    attestationHash: string
  ): MirrorMapping {
    if (this.byCreditId.has(creditId)) {
      throw new BridgeMappingError(
        `Mapping already exists for credit ${creditId}`
      );
    }

    const now = Date.now();
    const mapping: MirrorMapping = {
      creditId,
      gsSerial,
      attestationHash,
      state: BridgeState.PENDING,
      bridgeLocked: true,
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
      lastError: null,
    };

    this.byCreditId.set(creditId, mapping);
    if (gsSerial) {
      this.byGsSerial.set(gsSerial, mapping);
    }

    return mapping;
  }

  async getByGsSerial(gsSerial: string): Promise<MirrorMapping | null> {
    return this.byGsSerial.get(gsSerial) ?? null;
  }

  getByCreditId(creditId: string): MirrorMapping | null {
    return this.byCreditId.get(creditId) ?? null;
  }

  async updateState(creditId: string, newState: BridgeState): Promise<void> {
    const mapping = this.byCreditId.get(creditId);
    if (!mapping) {
      throw new BridgeMappingError(
        `No mapping found for credit ${creditId}`
      );
    }

    if (!isValidTransition(mapping.state, newState)) {
      throw new BridgeStateTransitionError(
        creditId,
        mapping.state,
        newState
      );
    }

    mapping.state = newState;
    mapping.bridgeLocked = isBridgeLocked(newState);
    mapping.updatedAt = Date.now();

    if (newState === BridgeState.REJECTED) {
      mapping.bridgeLocked = false;
    }
  }

  updateGsSerial(creditId: string, gsSerial: string): void {
    const mapping = this.byCreditId.get(creditId);
    if (!mapping) {
      throw new BridgeMappingError(
        `No mapping found for credit ${creditId}`
      );
    }

    if (mapping.gsSerial) {
      this.byGsSerial.delete(mapping.gsSerial);
    }

    mapping.gsSerial = gsSerial;
    mapping.updatedAt = Date.now();
    this.byGsSerial.set(gsSerial, mapping);
  }

  recordError(creditId: string, error: string): void {
    const mapping = this.byCreditId.get(creditId);
    if (!mapping) return;

    mapping.lastError = error;
    mapping.retryCount += 1;
    mapping.updatedAt = Date.now();
  }

  listByState(state: BridgeState): MirrorMapping[] {
    return Array.from(this.byCreditId.values()).filter(
      (m) => m.state === state
    );
  }

  listLocked(): MirrorMapping[] {
    return Array.from(this.byCreditId.values()).filter(
      (m) => m.bridgeLocked
    );
  }

  size(): number {
    return this.byCreditId.size;
  }
}

export class BridgeMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BridgeMappingError";
  }
}

export class BridgeStateTransitionError extends Error {
  constructor(
    public readonly creditId: string,
    public readonly fromState: BridgeState,
    public readonly toState: BridgeState
  ) {
    super(
      `Invalid state transition for credit ${creditId}: ${BridgeState[fromState]} -> ${BridgeState[toState]}`
    );
    this.name = "BridgeStateTransitionError";
  }
}
