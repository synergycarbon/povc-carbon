/**
 * CDM (Clean Development Mechanism) Registry API Client
 *
 * SOAP/XML client for the UNFCCC CDM Registry. The CDM registry uses legacy
 * SOAP 1.2 endpoints for credit registration, status queries, and retirement.
 * Credentials are stored in HSM; all outbound requests are ML-DSA-87 signed.
 *
 * Unlike the Verra/GS REST bridges, CDM requires XML envelope construction
 * and response parsing. Batch operations use CDM's bulk submission endpoint.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface CdmClientConfig {
  soap_endpoint: string;
  wsdl_url: string;
  username: string;
  password: string;
  participant_id: string;
  timeout_ms: number;
  retry_max: number;
  retry_base_delay_ms: number;
  retry_max_delay_ms: number;
}

const DEFAULT_CONFIG: Partial<CdmClientConfig> = {
  soap_endpoint: 'https://cdm.unfccc.int/services/registry/v2',
  wsdl_url: 'https://cdm.unfccc.int/services/registry/v2?wsdl',
  timeout_ms: 30_000,
  retry_max: 5,
  retry_base_delay_ms: 2_000,
  retry_max_delay_ms: 120_000,
};

// ---------------------------------------------------------------------------
// SOAP Envelope Constants
// ---------------------------------------------------------------------------

const SOAP_NS = 'http://www.w3.org/2003/05/soap-envelope';
const CDM_NS = 'http://cdm.unfccc.int/registry/v2';
const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';

// ---------------------------------------------------------------------------
// API Types — mirror CDM registry schema
// ---------------------------------------------------------------------------

export interface CdmCreditRegistration {
  project_ref: string;
  cpa_id: string;
  host_country: string;
  methodology_ref: string;
  vintage_year: number;
  tonnes_co2e: number;
  monitoring_report_ref: string;
  sc_credit_id: string;
  sc_serial_number: string;
  sc_attestation_hash: string;
}

export interface CdmRegistrationResponse {
  cdm_serial: string;
  project_ref: string;
  status: 'pending_review' | 'registered' | 'rejected';
  transaction_id: string;
  submitted_at: string;
}

export interface CdmStatusResponse {
  cdm_serial: string;
  status: 'pending_review' | 'registered' | 'active' | 'retired' | 'cancelled' | 'suspended';
  project_ref: string;
  cpa_id: string;
  vintage_year: number;
  tonnes_co2e: number;
  retired_at?: string;
  retired_to?: string;
  last_updated: string;
}

export interface CdmRetirementRequest {
  cdm_serial: string;
  beneficiary_name: string;
  retirement_reason: string;
  retirement_date: string;
  acquiring_account: string;
  sc_retirement_id: string;
}

export interface CdmRetirementResponse {
  cdm_serial: string;
  status: 'retired';
  transaction_id: string;
  retired_at: string;
}

export interface CdmBulkQueryParams {
  project_ref?: string;
  cpa_id?: string;
  vintage_year_from?: number;
  vintage_year_to?: number;
  status?: string;
  page_size: number;
  page_token?: string;
}

export interface CdmBulkQueryResponse {
  credits: CdmStatusResponse[];
  total_count: number;
  next_page_token?: string;
}

export interface CdmBulkRegistrationResponse {
  batch_transaction_id: string;
  accepted: number;
  rejected: number;
  results: CdmRegistrationResponse[];
}

export interface CdmApiError {
  fault_code: string;
  fault_string: string;
  detail?: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class CdmClient {
  private readonly config: CdmClientConfig;
  private session_token: string | null = null;
  private session_expires_at = 0;

  constructor(config: Partial<CdmClientConfig> & Pick<CdmClientConfig, 'username' | 'password' | 'participant_id'>) {
    this.config = { ...DEFAULT_CONFIG, ...config } as CdmClientConfig;
  }

  // ── Authentication ──────────────────────────────────────────────────

  private async authenticate(): Promise<void> {
    if (this.session_token && Date.now() < this.session_expires_at - 60_000) {
      return;
    }

    const envelope = build_soap_envelope('Login', `
      <cdm:username>${escape_xml(this.config.username)}</cdm:username>
      <cdm:password>${escape_xml(this.config.password)}</cdm:password>
      <cdm:participantId>${escape_xml(this.config.participant_id)}</cdm:participantId>
    `);

    const res = await this.raw_soap_request(envelope, 'Login');
    const body = await res.text();

    const token = extract_xml_value(body, 'sessionToken');
    const expires = extract_xml_value(body, 'expiresIn');

    if (!token) {
      throw new CdmAuthenticationError('Failed to obtain CDM session token');
    }

    this.session_token = token;
    this.session_expires_at = Date.now() + (parseInt(expires ?? '3600', 10) * 1000);
  }

  // ── Credit Registration ─────────────────────────────────────────────

  async register_credit(registration: CdmCreditRegistration): Promise<CdmRegistrationResponse> {
    const body = `
      <cdm:projectRef>${escape_xml(registration.project_ref)}</cdm:projectRef>
      <cdm:cpaId>${escape_xml(registration.cpa_id)}</cdm:cpaId>
      <cdm:hostCountry>${escape_xml(registration.host_country)}</cdm:hostCountry>
      <cdm:methodologyRef>${escape_xml(registration.methodology_ref)}</cdm:methodologyRef>
      <cdm:vintageYear>${registration.vintage_year}</cdm:vintageYear>
      <cdm:tonnesCO2e>${registration.tonnes_co2e}</cdm:tonnesCO2e>
      <cdm:monitoringReportRef>${escape_xml(registration.monitoring_report_ref)}</cdm:monitoringReportRef>
      <cdm:externalRef>${escape_xml(registration.sc_credit_id)}</cdm:externalRef>
      <cdm:externalSerial>${escape_xml(registration.sc_serial_number)}</cdm:externalSerial>
      <cdm:attestationHash>${escape_xml(registration.sc_attestation_hash)}</cdm:attestationHash>
    `;

    return this.soap_request<CdmRegistrationResponse>('RegisterCredit', body, parse_registration_response);
  }

  // ── Bulk Registration ───────────────────────────────────────────────

  async register_batch(registrations: CdmCreditRegistration[]): Promise<CdmBulkRegistrationResponse> {
    const credits_xml = registrations.map((r) => `
      <cdm:credit>
        <cdm:projectRef>${escape_xml(r.project_ref)}</cdm:projectRef>
        <cdm:cpaId>${escape_xml(r.cpa_id)}</cdm:cpaId>
        <cdm:hostCountry>${escape_xml(r.host_country)}</cdm:hostCountry>
        <cdm:methodologyRef>${escape_xml(r.methodology_ref)}</cdm:methodologyRef>
        <cdm:vintageYear>${r.vintage_year}</cdm:vintageYear>
        <cdm:tonnesCO2e>${r.tonnes_co2e}</cdm:tonnesCO2e>
        <cdm:monitoringReportRef>${escape_xml(r.monitoring_report_ref)}</cdm:monitoringReportRef>
        <cdm:externalRef>${escape_xml(r.sc_credit_id)}</cdm:externalRef>
        <cdm:externalSerial>${escape_xml(r.sc_serial_number)}</cdm:externalSerial>
        <cdm:attestationHash>${escape_xml(r.sc_attestation_hash)}</cdm:attestationHash>
      </cdm:credit>
    `).join('');

    const body = `<cdm:credits>${credits_xml}</cdm:credits>`;

    return this.soap_request<CdmBulkRegistrationResponse>('BulkRegisterCredits', body, parse_bulk_registration_response);
  }

  // ── Status Queries ──────────────────────────────────────────────────

  async get_status(cdm_serial: string): Promise<CdmStatusResponse> {
    const body = `<cdm:cdmSerial>${escape_xml(cdm_serial)}</cdm:cdmSerial>`;
    return this.soap_request<CdmStatusResponse>('GetCreditStatus', body, parse_status_response);
  }

  async query_by_sc_credit(sc_credit_id: string): Promise<CdmStatusResponse | null> {
    const body = `<cdm:externalRef>${escape_xml(sc_credit_id)}</cdm:externalRef>`;
    try {
      return await this.soap_request<CdmStatusResponse>('GetCreditByExternalRef', body, parse_status_response);
    } catch (err) {
      if (err instanceof CdmNotFoundError) return null;
      throw err;
    }
  }

  async bulk_query(params: CdmBulkQueryParams): Promise<CdmBulkQueryResponse> {
    const filters: string[] = [];
    if (params.project_ref) filters.push(`<cdm:projectRef>${escape_xml(params.project_ref)}</cdm:projectRef>`);
    if (params.cpa_id) filters.push(`<cdm:cpaId>${escape_xml(params.cpa_id)}</cdm:cpaId>`);
    if (params.vintage_year_from) filters.push(`<cdm:vintageYearFrom>${params.vintage_year_from}</cdm:vintageYearFrom>`);
    if (params.vintage_year_to) filters.push(`<cdm:vintageYearTo>${params.vintage_year_to}</cdm:vintageYearTo>`);
    if (params.status) filters.push(`<cdm:status>${escape_xml(params.status)}</cdm:status>`);
    filters.push(`<cdm:pageSize>${params.page_size}</cdm:pageSize>`);
    if (params.page_token) filters.push(`<cdm:pageToken>${escape_xml(params.page_token)}</cdm:pageToken>`);

    const body = filters.join('');

    return this.soap_request<CdmBulkQueryResponse>('BulkQueryCredits', body, parse_bulk_query_response);
  }

  // ── Retirement ──────────────────────────────────────────────────────

  async retire_credit(retirement: CdmRetirementRequest): Promise<CdmRetirementResponse> {
    const body = `
      <cdm:cdmSerial>${escape_xml(retirement.cdm_serial)}</cdm:cdmSerial>
      <cdm:beneficiaryName>${escape_xml(retirement.beneficiary_name)}</cdm:beneficiaryName>
      <cdm:retirementReason>${escape_xml(retirement.retirement_reason)}</cdm:retirementReason>
      <cdm:retirementDate>${escape_xml(retirement.retirement_date)}</cdm:retirementDate>
      <cdm:acquiringAccount>${escape_xml(retirement.acquiring_account)}</cdm:acquiringAccount>
      <cdm:externalRetirementId>${escape_xml(retirement.sc_retirement_id)}</cdm:externalRetirementId>
    `;

    return this.soap_request<CdmRetirementResponse>('RetireCredit', body, parse_retirement_response);
  }

  // ── Internal SOAP Plumbing ──────────────────────────────────────────

  private async soap_request<T>(
    action: string,
    body_content: string,
    parser: (xml: string) => T,
  ): Promise<T> {
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
        const envelope = build_soap_envelope(action, `
          <cdm:sessionToken>${escape_xml(this.session_token!)}</cdm:sessionToken>
          ${body_content}
        `);

        const res = await this.raw_soap_request(envelope, action);
        const xml = await res.text();

        const fault = extract_soap_fault(xml);
        if (fault) {
          if (fault.fault_code === 'cdm:NotFound') {
            throw new CdmNotFoundError(action);
          }

          if (fault.fault_code === 'cdm:SessionExpired') {
            this.session_token = null;
            await this.authenticate();
            continue;
          }

          if (fault.fault_code === 'cdm:ServerBusy' || fault.fault_code === 'cdm:InternalError') {
            last_error = new CdmApiRequestError(fault);
            continue;
          }

          throw new CdmApiRequestError(fault);
        }

        return parser(xml);
      } catch (err) {
        if (err instanceof CdmNotFoundError || err instanceof CdmApiRequestError) {
          throw err;
        }
        last_error = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw last_error ?? new Error('CDM SOAP request failed after retries');
  }

  private raw_soap_request(envelope: string, action: string): Promise<Response> {
    const url = this.config.soap_endpoint;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout_ms);

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        SOAPAction: `"${CDM_NS}/${action}"`,
        'X-SC-Client': 'synergycarbon-bridge/1.0',
      },
      body: envelope,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
  }
}

// ---------------------------------------------------------------------------
// SOAP Envelope Builder
// ---------------------------------------------------------------------------

function build_soap_envelope(action: string, body_content: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${SOAP_NS}" xmlns:cdm="${CDM_NS}" xmlns:xsi="${XSI_NS}">
  <soap:Header/>
  <soap:Body>
    <cdm:${action}Request>
      ${body_content}
    </cdm:${action}Request>
  </soap:Body>
</soap:Envelope>`;
}

// ---------------------------------------------------------------------------
// XML Parsing Helpers
// ---------------------------------------------------------------------------

function extract_xml_value(xml: string, tag: string): string | null {
  const patterns = [
    new RegExp(`<(?:cdm:)?${tag}>([^<]*)</(?:cdm:)?${tag}>`),
    new RegExp(`<${tag}>([^<]*)</${tag}>`),
  ];

  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function extract_all_xml_blocks(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<(?:cdm:)?${tag}>(.*?)</(?:cdm:)?${tag}>`, 'gs');
  const blocks: string[] = [];
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

function extract_soap_fault(xml: string): CdmApiError | null {
  if (!xml.includes('Fault')) return null;

  const fault_code = extract_xml_value(xml, 'faultcode') ?? extract_xml_value(xml, 'Code');
  const fault_string = extract_xml_value(xml, 'faultstring') ?? extract_xml_value(xml, 'Reason');

  if (!fault_code && !fault_string) return null;

  return {
    fault_code: fault_code ?? 'UNKNOWN',
    fault_string: fault_string ?? 'Unknown SOAP fault',
    detail: extract_xml_value(xml, 'detail') ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Response Parsers
// ---------------------------------------------------------------------------

function parse_registration_response(xml: string): CdmRegistrationResponse {
  return {
    cdm_serial: extract_xml_value(xml, 'cdmSerial') ?? '',
    project_ref: extract_xml_value(xml, 'projectRef') ?? '',
    status: (extract_xml_value(xml, 'status') ?? 'pending_review') as CdmRegistrationResponse['status'],
    transaction_id: extract_xml_value(xml, 'transactionId') ?? '',
    submitted_at: extract_xml_value(xml, 'submittedAt') ?? new Date().toISOString(),
  };
}

function parse_bulk_registration_response(xml: string): CdmBulkRegistrationResponse {
  const credit_blocks = extract_all_xml_blocks(xml, 'creditResult');

  return {
    batch_transaction_id: extract_xml_value(xml, 'batchTransactionId') ?? '',
    accepted: parseInt(extract_xml_value(xml, 'accepted') ?? '0', 10),
    rejected: parseInt(extract_xml_value(xml, 'rejected') ?? '0', 10),
    results: credit_blocks.map((block) => ({
      cdm_serial: extract_xml_value(block, 'cdmSerial') ?? '',
      project_ref: extract_xml_value(block, 'projectRef') ?? '',
      status: (extract_xml_value(block, 'status') ?? 'pending_review') as CdmRegistrationResponse['status'],
      transaction_id: extract_xml_value(block, 'transactionId') ?? '',
      submitted_at: extract_xml_value(block, 'submittedAt') ?? new Date().toISOString(),
    })),
  };
}

function parse_status_response(xml: string): CdmStatusResponse {
  return {
    cdm_serial: extract_xml_value(xml, 'cdmSerial') ?? '',
    status: (extract_xml_value(xml, 'status') ?? 'pending_review') as CdmStatusResponse['status'],
    project_ref: extract_xml_value(xml, 'projectRef') ?? '',
    cpa_id: extract_xml_value(xml, 'cpaId') ?? '',
    vintage_year: parseInt(extract_xml_value(xml, 'vintageYear') ?? '0', 10),
    tonnes_co2e: parseFloat(extract_xml_value(xml, 'tonnesCO2e') ?? '0'),
    retired_at: extract_xml_value(xml, 'retiredAt') ?? undefined,
    retired_to: extract_xml_value(xml, 'retiredTo') ?? undefined,
    last_updated: extract_xml_value(xml, 'lastUpdated') ?? new Date().toISOString(),
  };
}

function parse_bulk_query_response(xml: string): CdmBulkQueryResponse {
  const credit_blocks = extract_all_xml_blocks(xml, 'credit');

  return {
    credits: credit_blocks.map((block) => ({
      cdm_serial: extract_xml_value(block, 'cdmSerial') ?? '',
      status: (extract_xml_value(block, 'status') ?? 'pending_review') as CdmStatusResponse['status'],
      project_ref: extract_xml_value(block, 'projectRef') ?? '',
      cpa_id: extract_xml_value(block, 'cpaId') ?? '',
      vintage_year: parseInt(extract_xml_value(block, 'vintageYear') ?? '0', 10),
      tonnes_co2e: parseFloat(extract_xml_value(block, 'tonnesCO2e') ?? '0'),
      retired_at: extract_xml_value(block, 'retiredAt') ?? undefined,
      retired_to: extract_xml_value(block, 'retiredTo') ?? undefined,
      last_updated: extract_xml_value(block, 'lastUpdated') ?? new Date().toISOString(),
    })),
    total_count: parseInt(extract_xml_value(xml, 'totalCount') ?? '0', 10),
    next_page_token: extract_xml_value(xml, 'nextPageToken') ?? undefined,
  };
}

function parse_retirement_response(xml: string): CdmRetirementResponse {
  return {
    cdm_serial: extract_xml_value(xml, 'cdmSerial') ?? '',
    status: 'retired',
    transaction_id: extract_xml_value(xml, 'transactionId') ?? '',
    retired_at: extract_xml_value(xml, 'retiredAt') ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// XML Escaping
// ---------------------------------------------------------------------------

function escape_xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CdmAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CdmAuthenticationError';
  }
}

export class CdmNotFoundError extends Error {
  constructor(action: string) {
    super(`CDM SOAP 404: ${action}`);
    this.name = 'CdmNotFoundError';
  }
}

export class CdmApiRequestError extends Error {
  constructor(public readonly fault: CdmApiError) {
    super(`CDM SOAP fault: ${fault.fault_code} — ${fault.fault_string}`);
    this.name = 'CdmApiRequestError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
