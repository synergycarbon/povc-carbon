# SynergyCarbon B2B Integration API

> **Version:** 1.0.0
> **Base URL:** `https://edge.sc.estream.dev`
> **Transport:** HTTPS (REST/JSON) via eStream edge proxy
> **Design Reference:** [DESIGN.md](../docs/DESIGN.md) Section 8

---

## Audience

This API is for **external B2B server-to-server integrations only** — e-commerce platforms, ERP systems, registry bridges, carbon accounting tools, and other back-end services that need programmatic access to SynergyCarbon.

**This API is NOT for browser applications.** The SynergyCarbon Console and all Console Kit widgets access data via `useWidgetSubscription()`, `useEsliteQuery()`, and `useCircuit()` over the native WebTransport wire protocol. They never call these REST endpoints.

---

## Quick Start

### 1. Get an API Key

Request an API key through the SynergyCarbon Console (Settings > API Keys) or contact `api@synergycarbon.dev`. Each key is scoped to specific operations and visibility tiers.

### 2. Authenticate

All requests require a Bearer token — an ML-DSA-87 signed JWT:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://edge.sc.estream.dev/api/v1/credits
```

### 3. Explore the API

- **OpenAPI spec:** [`openapi.yaml`](openapi.yaml)
- **Webhook events:** [`webhooks.yaml`](webhooks.yaml)
- **Full specification:** [`docs/specs/b2b-api/SPEC.md`](../docs/specs/b2b-api/SPEC.md)

---

## Authentication

| Method | Use Case | Scope |
|--------|----------|-------|
| **API Key** (Bearer JWT) | Automated B2B integrations | Scoped to specific operations |
| **OAuth2 Client Credentials** | Third-party app integrations | Per-client scope |

JWTs are signed with ML-DSA-87. The `sub` claim maps to a Spark identity, which determines the caller's visibility tier (public, buyer, auditor, owner).

---

## Endpoints Overview

### Credits

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/credits` | List carbon credits (filtered, paginated) |
| `GET` | `/api/v1/credits/{credit_id}` | Get credit details |
| `POST` | `/api/v1/credits/{credit_id}/retire` | Retire a credit (irreversible) |

### Attestations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/attestations` | List verified PoVCR attestations |
| `GET` | `/api/v1/attestations/{attestation_id}` | Get attestation details |

### Retirements

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/retirements` | List retirement records |
| `GET` | `/api/v1/retirements/{retirement_id}` | Get retirement details + certificate |

### Marketplace

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/marketplace/listings` | List active credit listings |
| `POST` | `/api/v1/marketplace/orders` | Place an order to purchase credits |

### Forward Contracts

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/contracts` | List forward contracts (Carbon PPAs) |
| `GET` | `/api/v1/contracts/{contract_id}` | Get contract details + settlement history |

### Audit (Auditor Role Required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/audit/events` | List immutable audit trail events |
| `GET` | `/api/v1/audit/export` | Export audit data in regulatory format |

### Governance

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/governance/methodologies` | List approved methodologies |

---

## Pagination

All list endpoints use **cursor-based pagination**:

```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTAwfQ==",
    "prev_cursor": null,
    "has_more": true,
    "total_count": 1523
  }
}
```

Pass the cursor to the next request:

```bash
GET /api/v1/credits?cursor=eyJpZCI6MTAwfQ==&limit=25
```

Default page size is 25, maximum 100.

---

## Webhooks

B2B clients can register webhooks for outbound event notifications. Console Kit widgets do **not** use webhooks — they subscribe directly to lex topics via `useWidgetSubscription()` over WebTransport.

### Available Events

| Event | Lex Topic Equivalent | Description |
|-------|---------------------|-------------|
| `credit.issued` | `sc.credits.issued` | New credit minted from attestation |
| `credit.retired` | `sc.retirements.completed` | Credit permanently retired |
| `credit.transferred` | `sc.credits.transferred` | Credit ownership changed |
| `attestation.verified` | `sc.attestations.verified` | PoVCR attestation verified |
| `retirement.confirmed` | `sc.retirements.certificates` | Retirement certificate generated |
| `contract.settled` | `sc.forwards.settlement` | Forward contract settlement |
| `contract.defaulted` | `sc.forwards.risk.default` | Forward contract default |
| `governance.methodology_approved` | `sc.governance.methodology.approved` | Methodology approved |

### Delivery

- **At-least-once** delivery with exponential backoff (max 5 retries)
- Payloads include an `X-SC-Idempotency-Key` header for deduplication
- Each payload is signed with ML-DSA-87 (`X-SC-Signature` header)
- Your endpoint must return 2xx within 10 seconds

See [`webhooks.yaml`](webhooks.yaml) for full event payload schemas.

---

## Visibility Tiers

The fields returned in API responses depend on the caller's visibility tier, determined by the JWT `sub` claim:

| Tier | Access | Fields |
|------|--------|--------|
| **Public** | Anyone with a valid API key | credit_id, serial_number, tonnes_co2e, vintage, status, methodology |
| **Buyer** | Entities with buyer role | + project_location, issuer, pricing, seller, contract terms |
| **Auditor** | Third-party verifiers (90-day access) | + attestation details, raw telemetry samples, device IDs |
| **Owner** | Credit originators | All fields including cost data and revenue |

---

## Error Handling

All errors follow a consistent envelope:

```json
{
  "error": {
    "code": "credit_not_found",
    "message": "Credit with the specified ID does not exist",
    "request_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

Validation errors include per-field details:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Request body failed validation",
    "validation_errors": [
      { "field": "retirement_reason", "message": "Field is required", "code": "required" }
    ],
    "request_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created (orders) |
| `400` | Bad request (invalid parameters) |
| `401` | Unauthorized (missing/invalid token) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Not found |
| `409` | Conflict (resource state conflict) |
| `422` | Unprocessable entity (validation failure) |
| `429` | Rate limited (check `Retry-After` header) |

---

## Rate Limits

Default: **100 requests/second** per API key.

Rate limit headers are included in every response:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Requests allowed per window |
| `X-RateLimit-Remaining` | Requests remaining |
| `Retry-After` | Seconds until reset (on 429) |

---

## Idempotency

Write operations (`POST /api/v1/credits/{id}/retire`, `POST /api/v1/marketplace/orders`) accept an `Idempotency-Key` header (UUID). If a request with the same key has already been processed, the original response is returned without re-executing the operation. Keys expire after 24 hours.

---

## Architecture Context

```
┌──────────────────────────────┐     ┌──────────────────────────────┐
│  B2B Client                   │     │  SynergyCarbon Console       │
│  (ERP, e-commerce, registry)  │     │  (Console Kit deployment)    │
│                               │     │                              │
│  REST API (this spec)         │     │  WebTransport wire protocol  │
│  Bearer JWT (ML-DSA-87)       │     │  Spark auth (0x50–0x54)      │
└──────────┬───────────────────┘     └──────────┬───────────────────┘
           │ HTTPS                               │ HTTP/3 datagrams
           ▼                                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                     eStream Edge Proxy                            │
│                                                                   │
│  B2B path: JWT verify → RBAC → SmartCircuit invoke → JSON resp   │
│  Console path: WebTransport → WASM gateway → lex topic routing    │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                     eStream Network (L2)                          │
│  PoVCR Verifier | Credit Registry | Retirement Engine | Audit    │
│  Marketplace    | Forward Contracts | Governance                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Files in This Directory

| File | Description |
|------|-------------|
| [`openapi.yaml`](openapi.yaml) | OpenAPI 3.1 specification (all endpoints, schemas, auth) |
| [`webhooks.yaml`](webhooks.yaml) | Webhook event definitions with payload schemas |
| [`README.md`](README.md) | This file — B2B integration quick-start guide |

## Related

| Document | Location | Purpose |
|----------|----------|---------|
| [DESIGN.md](../docs/DESIGN.md) Section 8 | `docs/` | B2B integration design context |
| [B2B API Spec](../docs/specs/b2b-api/SPEC.md) | `docs/specs/b2b-api/` | Full specification |
| [RBAC Spec](../docs/specs/rbac/SPEC.md) | `docs/specs/rbac/` | Role and visibility tier details |
| [Compliance Spec](../docs/specs/compliance/SPEC.md) | `docs/specs/compliance/` | Audit trail and regulatory export |
