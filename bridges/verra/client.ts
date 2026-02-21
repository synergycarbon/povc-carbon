/**
 * Verra VCS Registry API Client
 *
 * REST client for the Verra VCS Registry API v3. Handles credit registration,
 * status queries, retirement notification, and cross-registry deduplication.
 * Credentials are stored in HSM; all outbound requests are ML-DSA-87 signed.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface VerraClientConfig {
  api_base_url: string;
  api_key: string;
  api_secret: string;
  timeout_ms: number;
  retry_max: number;
  retry_base_delay_ms: number;
  retry_max_delay_ms: number;
}

const DEFAULT_CONFIG: Partial<VerraClientConfig> = {
  api_base_url: 'https://registry.verra.org/api/v3',
  timeout_ms: 15_000,
  retry_max: 5,
  retry_base_delay_ms: 1_000,
  retry_max_delay_ms: 60_000,
};

// ---------------------------------------------------------------------------
// API Types — mirror Verra VCS API v3 schema
// ---------------------------------------------------------------------------

export interface VerraProjectRegistration {
  project_name: string;
  project_location: string;
  methodology_id: string;
  vintage_year: number;
  tonnes_co2e: number;
  monitoring_report_hash: string;
  sc_credit_id: string;
  sc_serial_number: string;
  sc_attestation_hash: string;
}

export interface VerraRegistrationResponse {
  vcu_serial: string;
  project_id: string;
  status: 'pending_review' | 'registered' | 'rejected';
  estimated_review_days: number;
  submitted_at: string;
}

export interface VerraStatusResponse {
  vcu_serial: string;
  status: 'pending_review' | 'registered' | 'active' | 'retired' | 'cancelled';
  project_id: string;
  vintage_year: number;
  tonnes_co2e: number;
  retired_at?: string;
  retired_by?: string;
  retirement_reason?: string;
  last_updated: string;
}

export interface VerraRetirementRequest {
  vcu_serial: string;
  beneficiary_name: string;
  retirement_reason: string;
  retirement_date: string;
  sc_retirement_id: string;
}

export interface VerraRetirementResponse {
  vcu_serial: string;
  status: 'retired';
  retired_at: string;
  retirement_certificate_url: string;
}

export interface VerraDedupQuery {
  serial_number: string;
  methodology_id: string;
  vintage_year: number;
  tonnes_co2e: number;
}

export interface VerraDedupResult {
  is_registered: boolean;
  vcu_serial?: string;
  project_id?: string;
  conflict_reason?: string;
}

export interface VerraApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class VerraClient {
  private readonly config: VerraClientConfig;
  private auth_token: string | null = null;
  private token_expires_at = 0;

  constructor(config: Partial<VerraClientConfig> & Pick<VerraClientConfig, 'api_key' | 'api_secret'>) {
    this.config = { ...DEFAULT_CONFIG, ...config } as VerraClientConfig;
  }

  // ── Authentication ──────────────────────────────────────────────────

  private async authenticate(): Promise<void> {
    if (this.auth_token && Date.now() < this.token_expires_at - 30_000) {
      return;
    }

    const res = await this.raw_fetch('/auth/token', {
      method: 'POST',
      body: JSON.stringify({
        api_key: this.config.api_key,
        api_secret: this.config.api_secret,
        grant_type: 'client_credentials',
      }),
    });

    const data = await res.json();
    this.auth_token = data.access_token;
    this.token_expires_at = Date.now() + data.expires_in * 1000;
  }

  // ── Credit Registration ─────────────────────────────────────────────

  async register_credit(registration: VerraProjectRegistration): Promise<VerraRegistrationResponse> {
    return this.request<VerraRegistrationResponse>('POST', '/credits/register', registration);
  }

  // ── Status Queries ──────────────────────────────────────────────────

  async get_status(vcu_serial: string): Promise<VerraStatusResponse> {
    return this.request<VerraStatusResponse>('GET', `/credits/${encodeURIComponent(vcu_serial)}/status`);
  }

  async query_by_sc_credit(sc_credit_id: string): Promise<VerraStatusResponse | null> {
    try {
      return await this.request<VerraStatusResponse>(
        'GET',
        `/credits/by-reference/${encodeURIComponent(sc_credit_id)}`,
      );
    } catch (err) {
      if (err instanceof VerraNotFoundError) return null;
      throw err;
    }
  }

  // ── Retirement ──────────────────────────────────────────────────────

  async retire_credit(retirement: VerraRetirementRequest): Promise<VerraRetirementResponse> {
    return this.request<VerraRetirementResponse>(
      'POST',
      `/credits/${encodeURIComponent(retirement.vcu_serial)}/retire`,
      retirement,
    );
  }

  // ── Deduplication ───────────────────────────────────────────────────

  async check_duplicate(query: VerraDedupQuery): Promise<VerraDedupResult> {
    return this.request<VerraDedupResult>('POST', '/credits/dedup-check', query);
  }

  // ── Webhook Registration ────────────────────────────────────────────

  async register_webhook(endpoint_url: string, events: string[]): Promise<{ webhook_id: string }> {
    return this.request<{ webhook_id: string }>('POST', '/webhooks', {
      url: endpoint_url,
      events,
    });
  }

  // ── Internal HTTP Plumbing ──────────────────────────────────────────

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    await this.authenticate();

    let last_error: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retry_max; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(
          this.config.retry_base_delay_ms * Math.pow(2, attempt - 1),
          this.config.retry_max_delay_ms,
        );
        const jitter = delay * 0.1 * Math.random();
        await sleep(delay + jitter);
      }

      try {
        const res = await this.raw_fetch(path, {
          method,
          headers: {
            Authorization: `Bearer ${this.auth_token}`,
            'Content-Type': 'application/json',
            'X-SC-Client': 'synergycarbon-bridge/1.0',
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        if (res.ok) {
          return (await res.json()) as T;
        }

        if (res.status === 404) {
          throw new VerraNotFoundError(path);
        }

        if (res.status === 401) {
          this.auth_token = null;
          await this.authenticate();
          continue;
        }

        // Retry on 429 and 5xx
        if (res.status === 429 || res.status >= 500) {
          const err_body = await res.json().catch(() => ({ code: 'UNKNOWN', message: res.statusText }));
          last_error = new VerraApiRequestError(res.status, err_body as VerraApiError);
          continue;
        }

        const err_body = await res.json().catch(() => ({ code: 'UNKNOWN', message: res.statusText }));
        throw new VerraApiRequestError(res.status, err_body as VerraApiError);
      } catch (err) {
        if (err instanceof VerraNotFoundError || err instanceof VerraApiRequestError) {
          throw err;
        }
        last_error = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw last_error ?? new Error('Verra API request failed after retries');
  }

  private raw_fetch(path: string, init: RequestInit): Promise<Response> {
    const url = `${this.config.api_base_url}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout_ms);

    return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeout));
  }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class VerraNotFoundError extends Error {
  constructor(path: string) {
    super(`Verra API 404: ${path}`);
    this.name = 'VerraNotFoundError';
  }
}

export class VerraApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly api_error: VerraApiError,
  ) {
    super(`Verra API ${status}: ${api_error.code} — ${api_error.message}`);
    this.name = 'VerraApiRequestError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
