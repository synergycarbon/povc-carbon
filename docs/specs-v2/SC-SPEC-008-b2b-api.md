# SC-SPEC-008: B2B API

> **Status**: Draft
> **Scope**: Edge proxy REST API (14 endpoints), 8 webhook event types, ML-DSA-87 signed JWT auth, rate limiting, cursor-based pagination
> **Platform**: eStream v0.8.3 (PolyQuantum Labs)

---

## 1. Overview

The SynergyCarbon B2B API is a REST/JSON interface served through the eStream **edge proxy** for server-to-server integrations. It connects carbon accounting platforms, ERP systems, e-commerce checkouts, registry bridges, and ESG reporting tools to the SynergyCarbon credit lifecycle.

**This API is NOT for browser applications.** The SynergyCarbon Console and all Console Kit widgets use the native WebTransport wire protocol via `useWidgetSubscription()` and `useEsliteQuery()`. They never call these REST endpoints.

### 1.1 Two Data Paths

| Path | Transport | Auth | Audience |
|------|-----------|------|----------|
| **Console Kit** (widgets) | WebTransport HTTP/3 datagrams | Spark wire protocol (0x50–0x54) | Browser-based Console users |
| **B2B REST API** (this spec) | HTTPS REST/JSON | ML-DSA-87 signed JWT | External services |

Both paths invoke the same SmartCircuits on the eStream network. The edge proxy translates REST requests into SmartCircuit invocations and returns structured JSON.

### 1.2 Base URL

| Environment | URL |
|-------------|-----|
| Production | `https://api.synergycarbon.com` |
| Staging | `https://api-staging.synergycarbon.com` |

---

## 2. Authentication

### 2.1 ML-DSA-87 Signed JWT

Primary method for automated B2B integrations. API keys are provisioned through the SynergyCarbon Console.

**Token format:** ML-DSA-87 signed JWT with claims:

| Claim | Description |
|-------|-------------|
| `sub` | Spark identity (hex) — determines visibility tier |
| `iss` | `synergycarbon.com` |
| `aud` | `api.synergycarbon.com` |
| `iat` | Issued-at timestamp |
| `exp` | Expiration (max 1 hour) |
| `scope` | Space-separated permissions (e.g., `credits:read credits:retire marketplace:order`) |
| `tier` | Visibility tier: `public`, `buyer`, `auditor`, `owner` |

**Request format:**

```
Authorization: Bearer <ML-DSA-87-signed-JWT>
```

### 2.2 OAuth2 Client Credentials

For service-to-service flows where API key rotation is managed externally:

```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=<id>&client_secret=<secret>&scope=credits:read
```

Returns a short-lived ML-DSA-87 signed JWT.

### 2.3 Scopes

| Scope | Operations |
|-------|------------|
| `credits:read` | GET /credits, GET /credits/{id} |
| `credits:write` | POST /credits/issue |
| `credits:retire` | POST /retirements |
| `attestations:read` | GET /attestations, GET /attestations/{id} |
| `retirements:read` | GET /retirements/{id} |
| `marketplace:read` | GET /orderbook |
| `marketplace:order` | POST /orders |
| `contracts:read` | GET /contracts |
| `contracts:write` | POST /contracts, PATCH /contracts/{id} |
| `audit:read` | GET /audit-trail |
| `governance:read` | GET /methodologies |

---

## 3. REST Endpoints

### 3.1 Credits

#### `GET /credits`

List credits with filtering and cursor-based pagination.

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter: `issued`, `listed`, `sold`, `retired`, `cancelled` |
| `vintage_year` | u16 | Filter by vintage year |
| `methodology` | string | Filter by methodology ID |
| `cursor` | string | Pagination cursor (opaque) |
| `limit` | u32 | Page size (default 50, max 200) |

**Response:** `200 OK`

```json
{
  "data": [
    {
      "credit_id": "0xabc123...",
      "project_id": "tz-wellpad-alpha-01",
      "vintage_year": 2026,
      "credit_type": "avoidance",
      "methodology": "EPA-AP42-CH4-FLARE",
      "tonnes_co2e": "1.000000",
      "status": "issued",
      "serial_number": "SC-2026-TZ-000001",
      "issued_at": "2026-02-15T10:30:00Z"
    }
  ],
  "pagination": {
    "next_cursor": "eyJ...",
    "has_more": true
  }
}
```

#### `GET /credits/{id}`

Retrieve a single credit by ID. Fields returned depend on the caller's visibility tier.

#### `POST /credits/issue`

Issue a new credit from a verified attestation. Requires `credits:write` scope and `owner` tier.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `attestation_id` | bytes32 | yes | Verified attestation to mint from |
| `project_id` | string | yes | Source project identifier |
| `vintage_year` | u16 | yes | Vintage year |
| `tonnes_co2e` | string | yes | Fixed-point tCO2e (6 decimals) |

**Response:** `201 Created` with the new credit object.

### 3.2 Attestations

#### `GET /attestations`

List attestations. Supports `status`, `project_id`, `cursor`, `limit` parameters.

#### `GET /attestations/{id}`

Retrieve a single attestation with witness details and Merkle root.

### 3.3 Retirements

#### `POST /retirements`

Retire one or more credits. Requires `credits:retire` scope.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `credit_ids` | bytes32[] | yes | Credits to retire |
| `beneficiary` | string | yes | Beneficiary name/org |
| `purpose` | string | no | Retirement purpose (e.g., "2026 ESG offset") |
| `metadata` | object | no | Additional metadata for certificate |

**Response:** `201 Created`

```json
{
  "retirement_id": "0xdef456...",
  "credits_retired": 3,
  "total_tonnes_co2e": "15.500000",
  "certificate_url": "https://api.synergycarbon.com/certificates/0xdef456...",
  "retired_at": "2026-02-15T14:00:00Z"
}
```

#### `GET /retirements/{id}`

Retrieve retirement details and downloadable certificate.

### 3.4 Marketplace

#### `GET /orderbook`

Current order book snapshot. Supports `methodology`, `vintage_year`, `side` (buy/sell) filters.

#### `POST /orders`

Place a buy or sell order. Requires `marketplace:order` scope.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `side` | string | yes | `buy` or `sell` |
| `credit_type` | string | yes | `avoidance`, `removal`, `sequestration` |
| `methodology` | string | no | Methodology filter |
| `vintage_year` | u16 | no | Vintage filter |
| `tonnes_co2e` | string | yes | Order quantity |
| `price_per_tonne` | string | yes | Limit price (USD, 6 decimals) |
| `expiry` | timestamp | no | Order expiration |

### 3.5 Contracts

#### `GET /contracts`

List forward contracts. Supports `status`, `counterparty`, `cursor`, `limit` parameters.

#### `POST /contracts`

Propose a new forward contract. Requires `contracts:write` scope.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `counterparty_id` | bytes32 | yes | Spark identity of counterparty |
| `delivery_start` | date | yes | Delivery window start |
| `delivery_end` | date | yes | Delivery window end |
| `committed_tonnes` | string | yes | Committed volume (tCO2e) |
| `price_per_tonne` | string | yes | Agreed price |
| `methodology` | string | yes | Required methodology |
| `penalty_rate` | string | no | Under-delivery penalty rate |

#### `PATCH /contracts/{id}`

Update contract status. Actions: `accept`, `reject`, `deliver`, `settle`, `default`.

### 3.6 Audit

#### `GET /audit-trail`

Paginated audit trail. Supports `event_type`, `tenant_id`, `from`, `to`, `cursor`, `limit` filters.

### 3.7 Governance

#### `GET /methodologies`

List approved methodologies with their parameters and compliance requirements.

---

## 4. Webhook Events

### 4.1 Event Types

| # | Event | Trigger | Payload Includes |
|---|-------|---------|-----------------|
| 1 | `credit.issued` | New credit minted | credit object |
| 2 | `credit.retired` | Credit retirement initiated | retirement_id, credit_ids, beneficiary |
| 3 | `credit.transferred` | Credit ownership changed | credit_id, from, to |
| 4 | `attestation.verified` | Attestation passed PoVCR verification | attestation object with witness details |
| 5 | `retirement.confirmed` | Retirement finalized on-chain | retirement_id, certificate_url, total_tonnes |
| 6 | `contract.settled` | Forward contract fully delivered | contract_id, delivered_tonnes, settlement_amount |
| 7 | `contract.defaulted` | Forward contract delivery failed | contract_id, shortfall_tonnes, penalty_amount |
| 8 | `governance.methodology_approved` | New methodology approved | methodology object |

### 4.2 Webhook Delivery

**Signing:** Every webhook payload is signed with ML-DSA-87. The signature is included in the `X-SC-Signature` header. Recipients verify using SynergyCarbon's public key (available at `GET /webhook-keys`).

**Delivery guarantees:**

| Property | Value |
|----------|-------|
| Delivery model | At-least-once |
| Initial timeout | 10 seconds |
| Retry strategy | Exponential backoff: 30s, 2m, 10m, 1h, 6h |
| Max retries | 8 |
| Deduplication | `X-SC-Event-Id` header (UUID v7) for idempotency |
| Ordering | Best-effort chronological; not guaranteed |

### 4.3 Webhook Payload Format

```json
{
  "id": "01936f5a-7b3c-7000-8000-000000000001",
  "type": "credit.issued",
  "created_at": "2026-02-15T10:30:00Z",
  "data": {
    "credit_id": "0xabc123...",
    "project_id": "tz-wellpad-alpha-01",
    "tonnes_co2e": "1.000000",
    "serial_number": "SC-2026-TZ-000001"
  }
}
```

**Headers:**

```
Content-Type: application/json
X-SC-Event-Id: 01936f5a-7b3c-7000-8000-000000000001
X-SC-Event-Type: credit.issued
X-SC-Signature: <ML-DSA-87 signature of body>
X-SC-Timestamp: 2026-02-15T10:30:00Z
```

### 4.4 Webhook Registration

```
POST /webhooks
{
  "url": "https://example.com/sc-webhook",
  "events": ["credit.issued", "credit.retired"],
  "secret": "<shared secret for HMAC verification fallback>"
}
```

---

## 5. Rate Limiting

### 5.1 Limits

| Tier | Sustained Rate | Burst | Window |
|------|---------------|-------|--------|
| Standard | 100 req/s | 500 req | Per API key |
| Premium | 500 req/s | 2,000 req | Per API key |

### 5.2 Headers

Rate limit state is communicated via response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1708012800
X-RateLimit-Burst-Remaining: 412
```

### 5.3 Exceeded Response

```
HTTP/1.1 429 Too Many Requests
Retry-After: 2

{
  "type": "https://api.synergycarbon.com/problems/rate-limited",
  "title": "Rate limit exceeded",
  "status": 429,
  "detail": "100 requests per second limit exceeded. Retry after 2 seconds.",
  "instance": "/credits"
}
```

---

## 6. Pagination

All list endpoints use **cursor-based pagination**.

### 6.1 Request

| Parameter | Type | Default | Max |
|-----------|------|---------|-----|
| `cursor` | string (opaque) | — (first page) | — |
| `limit` | u32 | 50 | 200 |

### 6.2 Response

```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJjcmVkaXRfaWQiOiIweGFiYzEyMyJ9",
    "has_more": true
  }
}
```

- `next_cursor` is `null` when no more results
- Cursors are opaque; clients must not parse or construct them
- Cursors are valid for 24 hours after issuance

---

## 7. Error Format

All errors follow [RFC 7807 Problem Details](https://tools.ietf.org/html/rfc7807).

### 7.1 Error Response Structure

```json
{
  "type": "https://api.synergycarbon.com/problems/credit-not-found",
  "title": "Credit not found",
  "status": 404,
  "detail": "No credit with ID 0xabc123... exists in the registry.",
  "instance": "/credits/0xabc123..."
}
```

### 7.2 Standard Error Types

| Type Suffix | Status | Description |
|-------------|--------|-------------|
| `unauthorized` | 401 | Missing or invalid JWT |
| `forbidden` | 403 | Valid JWT but insufficient scope or tier |
| `not-found` | 404 | Resource does not exist |
| `validation-error` | 422 | Request body validation failed |
| `rate-limited` | 429 | Rate limit exceeded |
| `conflict` | 409 | Duplicate operation (e.g., double retirement) |
| `internal-error` | 500 | Unexpected server error |

### 7.3 Validation Errors

```json
{
  "type": "https://api.synergycarbon.com/problems/validation-error",
  "title": "Validation error",
  "status": 422,
  "detail": "Request body contains invalid fields.",
  "errors": [
    { "field": "tonnes_co2e", "message": "Must be a positive decimal string" },
    { "field": "vintage_year", "message": "Must be between 2020 and 2030" }
  ]
}
```

---

## 8. Versioning & Deprecation

- API version is embedded in the `Accept` header: `Accept: application/json; version=1`
- Default version: latest stable
- Deprecation notice: `Sunset` header with deprecation date
- Minimum 6-month deprecation window before removal
- Breaking changes only in major version increments

---

## 9. OpenAPI Specification

The full OpenAPI 3.1 spec is available at:

| Format | URL |
|--------|-----|
| JSON | `https://api.synergycarbon.com/openapi.json` |
| YAML | `https://api.synergycarbon.com/openapi.yaml` |
| Interactive docs | `https://api.synergycarbon.com/docs` |

The spec is auto-generated from SmartCircuit interface definitions and kept in sync with the edge proxy routing table.
