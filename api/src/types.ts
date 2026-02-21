export type CreditStatus = 'issued' | 'listed' | 'sold' | 'retired' | 'cancelled';
export type CreditType = 'avoidance' | 'removal' | 'sequestration';
export type ContractStatus = 'proposed' | 'negotiation' | 'active' | 'delivering' | 'completed' | 'suspended' | 'defaulted' | 'terminated';
export type ContractType = 'fixed_term' | 'project_lifetime' | 'volume_committed' | 'callable';
export type VisibilityTier = 'public' | 'buyer' | 'auditor' | 'owner';
export type AuditAction = 'issue' | 'transfer' | 'retire' | 'list' | 'cancel' | 'verify' | 'settle' | 'propose' | 'vote';
export type MethodologyStatus = 'approved' | 'test_period' | 'proposed' | 'deprecated';
export type ExportFormat = 'ghg_protocol_csv' | 'ghg_protocol_xlsx' | 'verra_vcs' | 'gold_standard' | 'iscc_json' | 'soc2';

export const API_SCOPES = [
  'credits:read',
  'credits:write',
  'credits:retire',
  'attestations:read',
  'retirements:read',
  'marketplace:read',
  'marketplace:order',
  'triggers:write',
  'audit:read',
  'audit:export',
  'governance:read',
  'contracts:read',
  'contracts:write',
  'impact:read',
  'webhooks:read',
  'webhooks:write',
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export interface JwtClaims {
  sub: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  scope: string;
  tier: VisibilityTier;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    next_cursor: string | null;
    prev_cursor: string | null;
    has_more: boolean;
    total_count?: number;
  };
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    request_id: string;
  };
}

export interface ValidationErrorResponse {
  error: {
    code: 'validation_failed';
    message: string;
    validation_errors: Array<{
      field: string;
      message: string;
      code?: string;
    }>;
    request_id: string;
  };
}
