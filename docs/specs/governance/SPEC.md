# Platform Governance Specification

> **Spec Collection:** governance
> **Implementation Phase:** Phase 6 (cross-cutting)
> **Circuit:** `sc.governance.v1` (`circuits/governance/governance.escir.yaml`)
> **Design Reference:** [DESIGN.md](../../DESIGN.md) — governance lex topics
> **ESCIR Version:** 0.8.1

---

## 1. Overview

Platform governance manages the lifecycle of methodologies, verifier keys, and platform parameters for SynergyCarbon. All governance actions require ML-DSA-87 signatures from authorized governance key holders and follow a proposal-vote-execute workflow.

Governance events are published to `lex://sc/governance/*` topics for real-time Console Kit widget updates and audit trail recording.

---

## 2. Governance Domains

### 2.1 Methodology Approval

Carbon calculation methodologies define how energy generation measurements are converted to tCO2e credits. Each methodology specifies:

- **Source types**: Energy sources it applies to (thermoelectric, solar, wind, biogas, CCS, etc.)
- **Emission factor model**: How grid displacement or avoided emissions are calculated
- **Baseline algorithm**: Historical baseline determination (rolling average, regression, etc.)
- **Validation rules**: Automated constraints on input data
- **Registry compatibility**: Which external registries (Verra, Gold Standard, ISCC) accept credits minted under this methodology

**Workflow:**
1. Proposer submits methodology definition via `lex://sc/governance/methodology/propose`
2. Governance key holders vote during the voting window (default: 7 days)
3. If quorum (default: 3) is reached, methodology is approved and added to `approved_methodologies` state
4. Approved methodology emitted to `lex://sc/governance/methodology/approved`
5. PoVCR Verifier begins accepting attestations using this methodology

### 2.2 Verifier Registration

Witness verifiers are entities with ML-DSA-87 key pairs authorized to attest energy generation. Registration includes:

- **Public key**: ML-DSA-87 public key (1952 bytes)
- **Capabilities**: Source types the verifier can attest
- **Rate limit**: Maximum attestations per epoch
- **Status lifecycle**: `active` → `suspended` → `revoked`

**Workflow:**
1. Verifier submits registration via `lex://sc/governance/verifier/register`
2. Governance vote to approve registration
3. Approved verifier key added to `registered_verifiers` state
4. PoVCR Verifier accepts signatures from this key

### 2.3 Parameter Management

Platform parameters control quorum thresholds, deviation limits, and operational bounds:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `verifier.quorum_size` | 3 | Required witness quorum for attestation |
| `verifier.quorum_window_s` | 300 | Quorum collection window |
| `verifier.max_energy_deviation_pct` | 5.0 | Maximum energy claim deviation |
| `credit.baseline_deviation_pct` | 20.0 | Maximum baseline deviation |
| `governance.quorum` | 3 | Required governance signers |
| `governance.voting_window_s` | 604800 | Proposal voting window |
| `retirement.confirmation_delay_s` | 86400 | Retirement confirmation delay |

**Workflow:**
1. Proposer submits parameter change via `lex://sc/governance/parameters/propose`
2. Governance vote with rationale
3. Approved change takes effect at specified `effective_epoch`

### 2.4 Verifier Revocation

Governance can revoke a verifier's key, immediately preventing further attestations:

1. Propose revocation via governance
2. Quorum vote
3. Verifier status set to `revoked` in state
4. All subsequent signatures from this key are rejected

---

## 3. Lex Topic Schema

```
sc.governance.
├── methodology.propose        # Inbound: methodology proposals
├── methodology.approved       # Outbound: approved methodologies
├── verifier.register          # Inbound: verifier registrations
├── verifier.registered        # Outbound: registered verifiers
├── parameters.propose         # Inbound: parameter change proposals
├── parameters.updated         # Outbound: parameter changes
├── proposals.vote             # Inbound: governance votes
├── proposals.created          # Outbound: new proposals
├── proposals.voted            # Outbound: vote events
├── proposals.result           # Outbound: final proposal state
└── events                     # Outbound: all governance events (audit)
```

---

## 4. Console Kit Integration

The **Governance Widget** (`sc-governance-widget`) in the Console Kit displays:

- Active proposals with voting status
- Approved methodologies registry
- Registered verifiers and their status
- Parameter change history

**Required roles:** `owner` (vote, propose), `auditor` (read-only view)

**Lex subscriptions:**
- `lex://sc/governance/proposals/*` — real-time proposal updates
- `lex://sc/governance/methodology/approved` — methodology registry
- `lex://sc/governance/verifier/registered` — verifier registry

**Spark actions:**
- `governance_vote` — requires `owner` role with ML-DSA-87 signature

---

## 5. Security

- All governance actions require ML-DSA-87 post-quantum signatures
- Governance keys are separate from verifier keys (separation of concerns)
- Quorum prevents single-actor governance changes
- All governance events recorded in audit trail circuit (`sc.core.audit_trail.v1`)
- Voting window prevents rushed governance actions
- Parameter changes have a delayed effective epoch for safety

---

## 6. Cross-References

| Document | Purpose |
|----------|---------|
| [DESIGN.md](../../DESIGN.md) | Master design — governance lex topics |
| [governance.escir.yaml](../../../circuits/governance/governance.escir.yaml) | ESCIR v0.8.1 circuit definition |
| [audit_trail.escir.yaml](../../../circuits/core/audit_trail.escir.yaml) | Audit recording of governance events |
| [povcr_verifier.escir.yaml](../../../circuits/core/povcr_verifier.escir.yaml) | Consumer of approved methodologies and verifier keys |
