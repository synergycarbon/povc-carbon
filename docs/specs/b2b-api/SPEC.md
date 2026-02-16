# B2B Integration API Specification

> **Spec Collection:** b2b-api
> **Implementation Phase:** Phase 3 (Wk 13-18)
> **Transport:** HTTPS (REST/JSON) via eStream edge proxy
> **Design Reference:** [DESIGN.md](../../DESIGN.md) Section 8
> **OpenAPI Spec:** [api/openapi.yaml](../../../api/openapi.yaml)
> **Webhook Definitions:** [api/webhooks.yaml](../../../api/webhooks.yaml)

---

## 1. Overview

The SynergyCarbon B2B Integration API provides a REST/JSON interface for external server-to-server integrations. It is served through the eStream **edge-proxy thin proxy** and is intended exclusively for e-commerce platforms, ERP systems, registry bridges, carbon accounting tools, and other back-end services.

**This API is NOT for browser applications.** The SynergyCarbon Console and all Console Kit widgets use the native WebTransport wire protocol via `useWidgetSubscription()`, `useEsliteQuery()`, and `useCircuit()`. They never call these REST endpoints. See [DESIGN.md](../../DESIGN.md) Section 2.3 for the Console Kit data flow.

### 1.1 Two Data Paths

SynergyCarbon has two distinct data access paths, each optimized for its audience:

| Path | Transport | Auth | Audience | Data Access |
|------|-----------|------|----------|-------------|
| **Console Kit** (widgets) | WebTransport HTTP/3 datagrams | Spark wire protocol (0x50-0x54) | Browser-based Console users | `useWidgetSubscription()`, `useEsliteQuery()`, `useCircuit()` — real-time lex topic subscriptions |
| **B2B REST API** (this spec) | HTTPS REST/JSON | ML-DSA-87 signed JWT | External services (ERP, e-commerce, registries) | Request/response with cursor-based pagination |

Both paths ultimately invoke the same SmartCircuits on the eStream network. The edge proxy translates REST requests into SmartCircuit invocations and returns structured JSON responses.

### 1.2 Base URL

| Environment | URL |
|-------------|-----|
| Production | `https://edge.sc.estream.dev` |
| Staging | `https://edge-staging.sc.estream.dev` |

---

## 2. Authentication

### 2.1 API Key (Bearer JWT)

Primary method for automated B2B integrations. API keys are provisioned through the SynergyCarbon Console or registration API.

**Token format:** ML-DSA-87 signed JWT with the following claims:

| Claim | Description |
|-------|-------------|
| `sub` | Spark identity (hex) — determines visibility tier |
| `iss` | `sc.estream.dev` |
| `aud` | `edge.sc.estream.dev` |
| `iat` | Issued-at timestamp |
| `exp` | Expiration timestamp |
| `scope` | Space-separated list of allowed operations (e.g., `credits:read credits:retire marketplace:order`) |
| `tier` | Visibility tier: `public`, `buyer`, `auditor`, `owner` |

**Request format:**

```
Authorization: Bearer <ML-DSA-87-signed-JWT>
```

### 2.2 OAuth2 Client Credentials

For third-party app integrations that need delegated access:

```
POST https://edge.sc.estream.dev/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=CLIENT_ID&client_secret=CLIENT_SECRET&scope=credits:read
```

Returns a short-lived JWT with the same claim structure.

### 2.3 Scopes

| Scope | Grants |
|-------|--------|
| `credits:read` | List and get credit details |
| `credits:retire` | Retire owned credits |
| `attestations:read` | List and get attestation details |
| `retirements:read` | List and get retirement records |
| `marketplace:read` | Browse marketplace listings |
| `marketplace:order` | Place purchase orders |
| `contracts:read` | List and get forward contracts |
| `audit:read` | Access audit trail (requires auditor tier) |
| `audit:export` | Export audit data (requires auditor tier) |
| `governance:read` | List methodologies and governance state |

---

## 3. Endpoints

### 3.1 Credits

#### GET /api/v1/credits

List carbon credits with filters. Returns fields based on caller visibility tier.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cursor` | string | Pagination cursor |
| `limit` | integer (1-100, default 25) | Page size |
| `status` | enum | `issued`, `listed`, `sold`, `retired`, `cancelled` |
| `vintage_year` | integer | Exact vintage year |
| `vintage_year_min` | integer | Minimum vintage (inclusive) |
| `vintage_year_max` | integer | Maximum vintage (inclusive) |
| `credit_type` | enum | `avoidance`, `removal`, `sequestration` |
| `methodology` | string | Methodology ID |
| `project_id` | string | Source project |
| `owner` | hex string | Owner Spark identity |
| `sort` | enum | `issued_at`, `vintage_year`, `tonnes_co2e` |
| `order` | enum | `asc`, `desc` (default `desc`) |

**Required scope:** `credits:read`

#### GET /api/v1/credits/{credit_id}

Get full details for a single credit. Fields returned depend on visibility tier.

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `credit_id` | hex string (64 chars) | Credit ID (bytes32) |

**Required scope:** `credits:read`

#### POST /api/v1/credits/{credit_id}/retire

Retire a carbon credit permanently. The caller must be the credit owner or an authorized delegate.

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `credit_id` | hex string (64 chars) | Credit ID to retire |

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `retirement_reason` | string (1-500) | Yes | Reason for retirement |
| `beneficiary_name` | string (max 200) | No | Name for the certificate |
| `beneficiary_id` | string | No | External beneficiary ID |
| `metadata` | object | No | Arbitrary metadata |

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| `Idempotency-Key` | No | UUID for safe retries (24h TTL) |

**Required scope:** `credits:retire`

**Response:** Retirement record with certificate ID and download URLs.

**Error cases:**

| Status | Code | Condition |
|--------|------|-----------|
| 403 | `not_owner` | Caller is not the credit owner or delegate |
| 404 | `credit_not_found` | Credit ID does not exist |
| 409 | `credit_not_retirable` | Credit is already retired, cancelled, or listed |
| 422 | `validation_failed` | Missing or invalid fields |

### 3.2 Attestations

#### GET /api/v1/attestations

List verified PoVCR attestation records.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cursor` | string | Pagination cursor |
| `limit` | integer (1-100) | Page size |
| `project_id` | string | Source project |
| `tenant_id` | string | Tenant ID |
| `methodology` | string | Methodology ID |
| `verified_after` | ISO 8601 datetime | Lower bound |
| `verified_before` | ISO 8601 datetime | Upper bound |

**Required scope:** `attestations:read`

#### GET /api/v1/attestations/{attestation_id}

Get full details for a single attestation. Auditor-tier fields (tenant_id, device IDs, raw telemetry samples) require `auditor` visibility tier.

**Required scope:** `attestations:read`

### 3.3 Retirements

#### GET /api/v1/retirements

List retirement records.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cursor` | string | Pagination cursor |
| `limit` | integer (1-100) | Page size |
| `retired_by` | hex string | Retiring entity |
| `project_id` | string | Source project |
| `retired_after` | ISO 8601 datetime | Lower bound |
| `retired_before` | ISO 8601 datetime | Upper bound |

**Required scope:** `retirements:read`

#### GET /api/v1/retirements/{retirement_id}

Get retirement details including the generated certificate (PDF URL, verification URL, on-chain record hash) and linked attestation data.

**Required scope:** `retirements:read`

### 3.4 Marketplace

#### GET /api/v1/marketplace/listings

List active credit listings on the SynergyCarbon marketplace.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cursor` | string | Pagination cursor |
| `limit` | integer (1-100) | Page size |
| `vintage_year` | integer | Vintage year |
| `credit_type` | enum | Credit type |
| `methodology` | string | Methodology ID |
| `source_type` | enum | `TEG`, `solar`, `wind`, `CCS`, `biogas`, `nature_based` |
| `price_min` | number | Min price per tonne (USD) |
| `price_max` | number | Max price per tonne (USD) |
| `min_quantity` | number | Min total tonnes available |
| `sort` | enum | `price_per_tonne`, `total_tonnes`, `created_at`, `vintage_year` |
| `order` | enum | `asc`, `desc` |

**Required scope:** `marketplace:read`

#### POST /api/v1/marketplace/orders

Place an order to purchase credits from a listing.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `listing_id` | string | Yes | Listing to purchase from |
| `quantity_tonnes` | number (min 0.001) | Yes | Quantity (tCO2e) |
| `max_price_per_tonne` | number | No | Price ceiling (rejects if listing exceeds) |
| `auto_retire` | boolean | No | Auto-retire on settlement |
| `retirement_reason` | string | Conditional | Required if `auto_retire` is true |
| `beneficiary_name` | string | No | For auto-retirement certificate |
| `metadata` | object | No | Order metadata |

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| `Idempotency-Key` | No | UUID for safe retries (24h TTL) |

**Required scope:** `marketplace:order`

**Settlement flow:**

1. Order accepted — buyer funds held in eStream L2 escrow
2. Credit ownership transferred to buyer
3. Funds released to seller
4. Both parties notified (webhook + audit trail)
5. If `auto_retire`, credit is immediately retired

### 3.5 Forward Contracts

#### GET /api/v1/contracts

List forward contracts (Carbon PPAs) visible to the caller.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cursor` | string | Pagination cursor |
| `limit` | integer (1-100) | Page size |
| `status` | enum | Contract status |
| `contract_type` | enum | `fixed_term`, `project_lifetime`, `volume_committed`, `callable` |
| `project_id` | string | Source project |

**Required scope:** `contracts:read`

#### GET /api/v1/contracts/{contract_id}

Get full contract details including delivery schedule, settlement history, risk score, and escrow status.

**Required scope:** `contracts:read`

### 3.6 Audit

**All audit endpoints require `auditor` visibility tier.**

#### GET /api/v1/audit/events

List immutable audit trail events. Every platform operation is logged with ML-DSA-87 signed records including actor, action, subject, and before/after state.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cursor` | string | Pagination cursor |
| `limit` | integer (1-100) | Page size |
| `action` | enum | `issue`, `transfer`, `retire`, `list`, `cancel`, `verify`, `settle`, `propose`, `vote` |
| `actor` | hex string | Actor identity |
| `subject` | string | Subject ID (credit, attestation, contract) |
| `after` | ISO 8601 datetime | Lower bound |
| `before` | ISO 8601 datetime | Upper bound |

**Required scope:** `audit:read`

#### GET /api/v1/audit/export

Export audit data in a regulatory-compliant format.

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | enum | Yes | `ghg_protocol_csv`, `ghg_protocol_xlsx`, `verra_vcs`, `gold_standard`, `iscc_json`, `soc2` |
| `start_date` | date | Yes | Export start (inclusive) |
| `end_date` | date | Yes | Export end (inclusive) |
| `project_id` | string | No | Scope to project |

Large exports are processed asynchronously. The response includes an `export_id` and a `download_url` that becomes available when the job completes.

**Required scope:** `audit:export`

**Supported formats:**

| Format | Standard | Output |
|--------|----------|--------|
| `ghg_protocol_csv` | GHG Protocol | CSV |
| `ghg_protocol_xlsx` | GHG Protocol | XLSX |
| `verra_vcs` | Verra VCS | VCS Registry API format |
| `gold_standard` | Gold Standard | GS Registry API format |
| `iscc_json` | ISCC | ISCC-compliant JSON |
| `soc2` | SOC2 | Structured audit log |

### 3.7 Governance

#### GET /api/v1/governance/methodologies

List approved carbon credit calculation methodologies. Includes supported methodologies from EPA, IPCC, Verra, Gold Standard, and CDM.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | enum | `approved`, `test_period`, `proposed`, `deprecated` |
| `source_type` | string | Applicable source type |

**Required scope:** `governance:read`

**Standard methodologies at launch:**

| ID | Name | Source Types |
|----|------|-------------|
| `EPA-AP42-CH4-FLARE` | EPA AP-42 methane flare avoidance | TEG, gas-to-power |
| `IPCC-AR5-100Y` | IPCC AR5 100-year GWP | All |
| `IPCC-AR5-20Y` | IPCC AR5 20-year GWP | All |
| `VCS-AMS-III-H` | Verra AMS-III.H (methane recovery) | Methane capture |
| `GS-MICRO-SCALE` | Gold Standard micro-scale | Small generators |
| `CDM-ACM0001` | CDM flare gas recovery | Flare gas |

---

## 4. Pagination

All list endpoints use **cursor-based pagination**. This provides stable pagination even when the underlying data changes between requests.

### 4.1 Response Envelope

```json
{
  "data": [ ... ],
  "pagination": {
    "next_cursor": "eyJpZCI6MTAwfQ==",
    "prev_cursor": "eyJpZCI6NTB9",
    "has_more": true,
    "total_count": 1523
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `next_cursor` | string or null | Cursor for next page |
| `prev_cursor` | string or null | Cursor for previous page |
| `has_more` | boolean | Whether more results exist |
| `total_count` | integer (optional) | Total matching records (omitted for large datasets) |

### 4.2 Usage

```bash
# First page
GET /api/v1/credits?limit=25

# Next page
GET /api/v1/credits?limit=25&cursor=eyJpZCI6MTAwfQ==
```

Default limit: 25. Maximum limit: 100.

---

## 5. Webhooks

B2B clients register webhook endpoints to receive real-time event notifications. Console Kit widgets subscribe directly to lex topics via WebTransport and do not use webhooks.

### 5.1 Event Catalog

| Event | Lex Topic Equivalent | Category | Description |
|-------|---------------------|----------|-------------|
| `credit.issued` | `sc.credits.issued` | credits | New credit minted from attestation |
| `credit.retired` | `sc.retirements.completed` | credits | Credit permanently retired |
| `credit.transferred` | `sc.credits.transferred` | credits | Credit ownership changed |
| `attestation.verified` | `sc.attestations.verified` | attestations | PoVCR attestation verified |
| `retirement.confirmed` | `sc.retirements.certificates` | retirements | Retirement certificate generated |
| `contract.settled` | `sc.forwards.settlement` | contracts | Forward contract settlement |
| `contract.defaulted` | `sc.forwards.risk.default` | contracts | Forward contract default |
| `governance.methodology_approved` | `sc.governance.methodology.approved` | governance | Methodology approved |

### 5.2 Delivery

- **Guarantee:** At-least-once delivery
- **Retry policy:** Exponential backoff — 5s, 10s, 20s, 40s, 80s (max 5 retries, max 1 hour)
- **Timeout:** Your endpoint must return 2xx within 10 seconds
- **Content type:** `application/json`
- **Idempotency:** Each event includes an `X-SC-Idempotency-Key` header (UUID)

### 5.3 Signature Verification

Each webhook POST includes:

| Header | Description |
|--------|-------------|
| `X-SC-Signature` | ML-DSA-87 signature over the raw request body |
| `X-SC-Timestamp` | Event timestamp (ISO 8601) |
| `X-SC-Idempotency-Key` | Unique event ID for deduplication |

Verify the signature against the SynergyCarbon webhook public key provided during registration. Reject any request older than 5 minutes (replay protection).

### 5.4 Registration

Webhooks are registered via the SynergyCarbon Console (Settings > Webhooks) or during API key provisioning. Each registration specifies:

- **Endpoint URL** (HTTPS required)
- **Events** to subscribe to (or `*` for all)
- **Secret** for signature verification

Full payload schemas: [`api/webhooks.yaml`](../../../api/webhooks.yaml)

---

## 6. Visibility Tiers

The B2B API respects the same visibility tier model as Console Kit widgets. The caller's tier is determined by the JWT `sub` claim mapping to a Spark identity.

| Tier | API Key Type | Fields Returned | Use Cases |
|------|-------------|-----------------|-----------|
| **Public** | Standard | credit_id, serial_number, tonnes_co2e, vintage, status, methodology | Credit verification, public data |
| **Buyer** | Buyer-scoped | + project_location, issuer, pricing, seller, contract terms | Due diligence, marketplace |
| **Auditor** | Auditor-scoped (90-day) | + attestation details, Merkle proofs, device IDs, telemetry | Third-party verification, compliance audit |
| **Owner** | Owner-scoped | All fields including cost, revenue, business metrics | Credit originator dashboards, ERP sync |

See [RBAC Spec](../rbac/SPEC.md) for full field-level access control definitions.

---

## 7. Error Handling

### 7.1 Error Envelope

All errors use a consistent structure:

```json
{
  "error": {
    "code": "credit_not_found",
    "message": "Credit with the specified ID does not exist",
    "request_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 7.2 Validation Errors

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Request body failed validation",
    "validation_errors": [
      { "field": "retirement_reason", "message": "Field is required", "code": "required" },
      { "field": "quantity_tonnes", "message": "Must be >= 0.001", "code": "minimum" }
    ],
    "request_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 7.3 Error Codes

| HTTP | Code | Description |
|------|------|-------------|
| 400 | `bad_request` | Malformed request |
| 401 | `unauthorized` | Missing or invalid token |
| 401 | `token_expired` | JWT has expired |
| 403 | `forbidden` | Insufficient tier/scope |
| 403 | `not_owner` | Action requires ownership |
| 404 | `credit_not_found` | Credit ID not found |
| 404 | `attestation_not_found` | Attestation ID not found |
| 404 | `retirement_not_found` | Retirement ID not found |
| 404 | `listing_not_found` | Listing ID not found |
| 404 | `contract_not_found` | Contract ID not found |
| 409 | `credit_not_retirable` | Credit in non-retirable state |
| 409 | `listing_unavailable` | Listing sold or expired |
| 409 | `duplicate_idempotency_key` | Idempotency conflict (original response returned) |
| 422 | `validation_failed` | Request body validation failure |
| 429 | `rate_limited` | Rate limit exceeded |

---

## 8. Rate Limiting

| Tier | Limit | Window |
|------|-------|--------|
| Standard | 100 req/s | Per API key |
| Elevated | 1,000 req/s | Per API key (approved) |
| Audit export | 10 req/min | Per API key |

Response headers on every request:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Requests allowed per window |
| `X-RateLimit-Remaining` | Requests remaining in window |
| `X-RateLimit-Reset` | Window reset timestamp (Unix) |
| `Retry-After` | Seconds until reset (on 429 only) |

---

## 9. Idempotency

Write operations accept an `Idempotency-Key` header (UUID v4). Behavior:

1. **First request:** Processed normally, response cached with the key
2. **Duplicate request (same key):** Original response returned, operation NOT re-executed
3. **Key expiry:** 24 hours after first use
4. **Different body, same key:** Returns 409 with `duplicate_idempotency_key`

Supported on:
- `POST /api/v1/credits/{credit_id}/retire`
- `POST /api/v1/marketplace/orders`

---

## 10. SmartCircuit Mapping

Each REST endpoint maps to a SmartCircuit invocation on the eStream network:

| Endpoint | SmartCircuit | Lex Topic |
|----------|-------------|-----------|
| GET /credits | `sc.core.credit_registry.v1` | `sc.credits.registry` |
| GET /credits/{id} | `sc.core.credit_registry.v1` | — |
| POST /credits/{id}/retire | `sc.core.retirement_engine.v1` | `sc.retirements.requested` |
| GET /attestations | `sc.core.povcr_verifier.v1` | `sc.attestations.registry` |
| GET /retirements | `sc.core.retirement_engine.v1` | `sc.retirements.completed` |
| GET /marketplace/listings | `sc.marketplace.orderbook.v1` | `sc.marketplace.listings.active` |
| POST /marketplace/orders | `sc.marketplace.orderbook.v1` | `sc.marketplace.orders` |
| GET /contracts | `sc.marketplace.forward_contracts.v1` | `sc.forwards.contracts.active` |
| GET /audit/events | `sc.core.audit_trail.v1` | `sc.audit.events` |
| GET /audit/export | `sc.core.audit_trail.v1` | `sc.audit.exports` |
| GET /governance/methodologies | `sc.governance.v1` | `sc.governance.methodology.approved` |

---

## 11. Implementation Notes

### 11.1 Edge Proxy Architecture

The edge proxy is a thin translation layer:

```
HTTP Request
    │
    ▼
JWT Verification (ML-DSA-87)
    │
    ▼
Scope & Tier Extraction
    │
    ▼
SmartCircuit Invocation (via eStream transport)
    │
    ▼
Response Transformation (ESF → JSON)
    │
    ▼
Field Filtering (per visibility tier)
    │
    ▼
HTTP Response (JSON)
```

The proxy does NOT cache responses. All data is served live from the eStream network.

### 11.2 Consistency Model

- **Read operations:** Eventually consistent (sub-second propagation from SmartCircuit state)
- **Write operations:** Strongly consistent (SmartCircuit acknowledgment before response)
- **Retirement:** Confirmed only after the SmartCircuit has committed the state transition

### 11.3 Phase 3 Delivery Scope

Phase 3 (Wk 13-18) delivers:

1. Credit CRUD endpoints (list, get, retire)
2. Retirement endpoints (list, get, certificates)
3. API key provisioning
4. JWT verification (ML-DSA-87)
5. Webhook delivery (credit.issued, credit.retired)
6. Audit trail logging for all API calls

Marketplace, contracts, audit export, and governance endpoints are delivered in later phases as their underlying SmartCircuits become available.

---

## 12. Exit Criteria

- [ ] All 14 endpoints functional and returning correct data
- [ ] ML-DSA-87 JWT verification working end-to-end
- [ ] Visibility tier field filtering enforced
- [ ] Cursor-based pagination stable under concurrent writes
- [ ] Idempotency working for retire and order endpoints
- [ ] All 8 webhook events delivering reliably
- [ ] Webhook signature verification documented and testable
- [ ] Rate limiting enforced with correct headers
- [ ] Audit trail logging every API call to `sc.audit.access_log`
- [ ] OpenAPI spec validates with no errors
- [ ] Integration test suite covering all endpoints

---

## 13. Cross-References

| Document | Location | Purpose |
|----------|----------|---------|
| [DESIGN.md](../../DESIGN.md) Section 8 | `docs/` | B2B integration design context |
| [openapi.yaml](../../../api/openapi.yaml) | `api/` | OpenAPI 3.1 specification |
| [webhooks.yaml](../../../api/webhooks.yaml) | `api/` | Webhook event definitions |
| [api/README.md](../../../api/README.md) | `api/` | Quick-start integration guide |
| [RBAC Spec](../rbac/SPEC.md) | `docs/specs/rbac/` | Visibility tiers and field-level access |
| [Compliance Spec](../compliance/SPEC.md) | `docs/specs/compliance/` | Audit trail and regulatory export |
| [Marketplace Spec](../marketplace/SPEC.md) | `docs/specs/marketplace/` | Order book and settlement |
| [Forward Contracts Spec](../forward-contracts/SPEC.md) | `docs/specs/forward-contracts/` | Carbon PPAs and streaming settlement |
| [Credit Lifecycle Spec](../credit-lifecycle/SPEC.md) | `docs/specs/credit-lifecycle/` | Credit registry and retirement engine |
| [Verification Spec](../verification/SPEC.md) | `docs/specs/verification/` | PoVCR protocol and attestations |
| [Spec Index](../INDEX.md) | `docs/specs/` | Master spec collection index |
