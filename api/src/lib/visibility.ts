import type { VisibilityTier } from '../types.js';

const TIER_LEVELS: Record<VisibilityTier, number> = {
  public: 0,
  buyer: 1,
  auditor: 2,
  owner: 3,
};

const CREDIT_PUBLIC_FIELDS = [
  'credit_id', 'serial_number', 'project_id', 'vintage_year',
  'credit_type', 'methodology', 'tonnes_co2e', 'status', 'issued_at',
];

const CREDIT_BUYER_FIELDS = [
  ...CREDIT_PUBLIC_FIELDS,
  'attestation_id', 'merkle_root', 'owner', 'retired_at', 'retired_by', 'retirement_reason',
];

const CREDIT_AUDITOR_FIELDS = [...CREDIT_BUYER_FIELDS];
const CREDIT_OWNER_FIELDS = [...CREDIT_AUDITOR_FIELDS];

const ATTESTATION_PUBLIC_FIELDS = [
  'attestation_id', 'project_id', 'epoch_id', 'methodology',
  'total_energy_wh', 'tonnes_co2e', 'quorum_count', 'quorum_required',
  'confidence', 'verified_at', 'credit_id',
];

const ATTESTATION_AUDITOR_FIELDS = [
  ...ATTESTATION_PUBLIC_FIELDS,
  'tenant_id', 'merkle_root',
];

const FIELD_MAP: Record<string, Record<VisibilityTier, string[]>> = {
  credit: {
    public: CREDIT_PUBLIC_FIELDS,
    buyer: CREDIT_BUYER_FIELDS,
    auditor: CREDIT_AUDITOR_FIELDS,
    owner: CREDIT_OWNER_FIELDS,
  },
  attestation: {
    public: ATTESTATION_PUBLIC_FIELDS,
    buyer: ATTESTATION_PUBLIC_FIELDS,
    auditor: ATTESTATION_AUDITOR_FIELDS,
    owner: ATTESTATION_AUDITOR_FIELDS,
  },
};

export function tierHasAccess(callerTier: VisibilityTier, requiredTier: VisibilityTier): boolean {
  return TIER_LEVELS[callerTier] >= TIER_LEVELS[requiredTier];
}

export function filterFields<T extends Record<string, unknown>>(
  data: T,
  resourceType: string,
  tier: VisibilityTier,
): Partial<T> {
  const allowedFields = FIELD_MAP[resourceType]?.[tier];
  if (!allowedFields) return data;

  const filtered: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in data) {
      filtered[field] = data[field];
    }
  }
  return filtered as Partial<T>;
}

export function filterFieldsArray<T extends Record<string, unknown>>(
  items: T[],
  resourceType: string,
  tier: VisibilityTier,
): Partial<T>[] {
  return items.map((item) => filterFields(item, resourceType, tier));
}
