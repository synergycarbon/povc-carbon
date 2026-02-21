/**
 * Gold Standard Registry API Client
 *
 * REST client for Gold Standard's registry API. Handles authentication,
 * batch credit registration, status polling, and retirement sync.
 * Credentials are resolved from the HSM vault reference (never stored in code).
 */

export interface GoldStandardCredentials {
  apiKey: string;
  apiSecret: string;
  endpoint: string;
}

export interface GSCredit {
  gsSerial: string;
  projectId: string;
  vintageYear: number;
  tonnesCo2e: number;
  methodologyId: string;
  projectName: string;
  projectLocation: string;
  status: "active" | "retired" | "cancelled";
}

export interface GSRegistrationRequest {
  scCreditId: string;
  attestationHash: string;
  creditMetadataHash: string;
  tonnesCo2e: number;
  vintageYear: number;
  projectName: string;
  projectLocation: string;
  methodologyId: string;
}

export interface GSRegistrationResponse {
  gsSerial: string;
  status: "pending" | "accepted" | "rejected";
  registeredAt: number;
  reviewEstimateDays: number;
}

export interface GSBatchRegistrationResponse {
  batchId: string;
  accepted: number;
  rejected: number;
  results: GSRegistrationResponse[];
}

export interface GSRetirementRequest {
  gsSerial: string;
  beneficiaryName: string;
  retirementReason: string;
  retiredAt: number;
}

export interface GSRetirementResponse {
  gsSerial: string;
  status: "retired" | "failed";
  retirementCertificateHash: string;
}

export interface GSCreditStatus {
  gsSerial: string;
  status: "active" | "retired" | "cancelled" | "pending_review";
  lastUpdated: number;
}

export class GoldStandardClient {
  private credentials: GoldStandardCredentials;
  private baseHeaders: Record<string, string>;

  constructor(credentials: GoldStandardCredentials) {
    this.credentials = credentials;
    this.baseHeaders = {
      "Content-Type": "application/json",
      "X-GS-API-Key": credentials.apiKey,
      Authorization: `Bearer ${credentials.apiSecret}`,
    };
  }

  static async fromVaultRef(
    vaultRef: Uint8Array,
    hsmResolve: (ref: Uint8Array) => Promise<GoldStandardCredentials>
  ): Promise<GoldStandardClient> {
    const credentials = await hsmResolve(vaultRef);
    return new GoldStandardClient(credentials);
  }

  async registerCredit(
    request: GSRegistrationRequest
  ): Promise<GSRegistrationResponse> {
    const response = await fetch(
      `${this.credentials.endpoint}/v1/credits/register`,
      {
        method: "POST",
        headers: this.baseHeaders,
        body: JSON.stringify({
          sc_credit_id: request.scCreditId,
          attestation_hash: request.attestationHash,
          credit_metadata_hash: request.creditMetadataHash,
          tonnes_co2e: request.tonnesCo2e,
          vintage_year: request.vintageYear,
          project_name: request.projectName,
          project_location: request.projectLocation,
          methodology_id: request.methodologyId,
        }),
      }
    );

    if (!response.ok) {
      throw new GoldStandardApiError(
        `Registration failed: ${response.status}`,
        response.status,
        await response.text()
      );
    }

    const data = await response.json();
    return {
      gsSerial: data.gs_serial,
      status: data.status,
      registeredAt: data.registered_at,
      reviewEstimateDays: data.review_estimate_days,
    };
  }

  async registerBatch(
    requests: GSRegistrationRequest[]
  ): Promise<GSBatchRegistrationResponse> {
    const response = await fetch(
      `${this.credentials.endpoint}/v1/credits/register/batch`,
      {
        method: "POST",
        headers: this.baseHeaders,
        body: JSON.stringify({
          credits: requests.map((r) => ({
            sc_credit_id: r.scCreditId,
            attestation_hash: r.attestationHash,
            credit_metadata_hash: r.creditMetadataHash,
            tonnes_co2e: r.tonnesCo2e,
            vintage_year: r.vintageYear,
            project_name: r.projectName,
            project_location: r.projectLocation,
            methodology_id: r.methodologyId,
          })),
        }),
      }
    );

    if (!response.ok) {
      throw new GoldStandardApiError(
        `Batch registration failed: ${response.status}`,
        response.status,
        await response.text()
      );
    }

    const data = await response.json();
    return {
      batchId: data.batch_id,
      accepted: data.accepted,
      rejected: data.rejected,
      results: data.results.map(
        (r: Record<string, unknown>) =>
          ({
            gsSerial: r.gs_serial,
            status: r.status,
            registeredAt: r.registered_at,
            reviewEstimateDays: r.review_estimate_days,
          }) as GSRegistrationResponse
      ),
    };
  }

  async getCreditStatus(gsSerial: string): Promise<GSCreditStatus> {
    const response = await fetch(
      `${this.credentials.endpoint}/v1/credits/${encodeURIComponent(gsSerial)}/status`,
      { method: "GET", headers: this.baseHeaders }
    );

    if (!response.ok) {
      throw new GoldStandardApiError(
        `Status check failed: ${response.status}`,
        response.status,
        await response.text()
      );
    }

    const data = await response.json();
    return {
      gsSerial: data.gs_serial,
      status: data.status,
      lastUpdated: data.last_updated,
    };
  }

  async retireCredit(
    request: GSRetirementRequest
  ): Promise<GSRetirementResponse> {
    const response = await fetch(
      `${this.credentials.endpoint}/v1/credits/${encodeURIComponent(request.gsSerial)}/retire`,
      {
        method: "POST",
        headers: this.baseHeaders,
        body: JSON.stringify({
          beneficiary_name: request.beneficiaryName,
          retirement_reason: request.retirementReason,
          retired_at: request.retiredAt,
        }),
      }
    );

    if (!response.ok) {
      throw new GoldStandardApiError(
        `Retirement failed: ${response.status}`,
        response.status,
        await response.text()
      );
    }

    const data = await response.json();
    return {
      gsSerial: data.gs_serial,
      status: data.status,
      retirementCertificateHash: data.retirement_certificate_hash,
    };
  }
}

export class GoldStandardApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string
  ) {
    super(message);
    this.name = "GoldStandardApiError";
  }
}
