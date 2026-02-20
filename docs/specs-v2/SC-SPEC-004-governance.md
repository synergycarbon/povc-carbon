# SC-SPEC-004: Governance

> **Status**: Draft
> **Version**: 2.0.0
> **Date**: 2026-02-20
> **Scope**: Methodology approval lifecycle, verifier registration and credentialing, governance voting, methodology versioning
> **Platform**: eStream v0.8.3 (PolyQuantum Labs)
> **Compliance**: EPA GHG, ISO 14064, Verra VCS, Gold Standard

---

## 1. Overview

Governance controls the rules under which SynergyCarbon operates: which methodologies are accepted, who can act as a verifier, and how the platform evolves. All governance decisions are recorded in a Merkle-chained series, making the decision history tamper-evident and auditable.

The governance model balances operational efficiency with independent oversight. A five-member governance committee — one registry admin plus four independent experts — approves methodologies and policy changes through a 3-of-5 threshold vote.

---

## 2. Methodology Lifecycle

### 2.1 State Machine

```
PROPOSED → UNDER_REVIEW → PUBLIC_COMMENT → APPROVED → ACTIVE → SUPERSEDED
```

| State | Description | Transitions |
|-------|-------------|-------------|
| `PROPOSED` | New methodology submitted for review | → UNDER_REVIEW, → REJECTED |
| `UNDER_REVIEW` | Governance committee evaluating technical merit | → PUBLIC_COMMENT, → REJECTED |
| `PUBLIC_COMMENT` | 30-day public comment period (open to all verified accounts) | → APPROVED, → UNDER_REVIEW (if revisions needed) |
| `APPROVED` | Committee vote passed (3-of-5); awaiting activation | → ACTIVE |
| `ACTIVE` | Methodology available for project verification | → SUPERSEDED |
| `SUPERSEDED` | Replaced by a newer version; existing credits remain valid | Terminal |
| `REJECTED` | Did not pass review or vote | Terminal |

### 2.2 Supported Methodologies

| Methodology | Source Type | Standard | Notes |
|-------------|-----------|----------|-------|
| EPA AP-42 (combustion) | Fossil fuel displacement | EPA | Emission factors for stationary combustion |
| Solar grid offset | Solar PV | Verra VM0006 | Grid displacement calculation |
| Methane destruction | Landfill / biogas | Verra VM0007 | Fugitive emission reduction |
| Carbon capture & storage (CCS) | Industrial | ISO 14064-2 | Injection rate monitoring |
| Biogas utilization | Agricultural / waste | Gold Standard | Methane avoidance + energy generation |

New methodologies follow the full lifecycle above. Variants of existing methodologies (e.g., regional calibration) may use an expedited review with 15-day public comment.

---

## 3. Methodology Versioning

Each methodology version is immutable once APPROVED:

```
MethodologyVersion {
  methodology_id   : string             # e.g. "VM0006"
  version          : semver             # e.g. "1.2.0"
  content_hash     : bytes(32)          # SHA3-256 of the full methodology document
  author           : account_id
  approved_by      : vote_id            # Reference to the approval vote
  effective_date   : uint64
  supersedes       : version | null     # Previous version if applicable
  parameters       : MethodologyParams  # Source-specific calibration defaults
}
```

### 3.1 Versioning Rules

- **Patch** (1.2.x): Clarifications, typo fixes — no re-approval required, committee notification only
- **Minor** (1.x.0): Parameter changes, regional calibration updates — expedited review (15-day comment)
- **Major** (x.0.0): Fundamental methodology change — full lifecycle, existing credits under old version remain valid

New major versions create a `supersedes` link. The old version enters `SUPERSEDED` state but remains queryable for audit purposes.

---

## 4. Verifier Registration

### 4.1 Organization Registration

Verifier organizations apply through the governance module:

```
VerifierApplication {
  org_id           : UUID v7
  legal_name       : string
  jurisdiction     : string             # ISO 3166-1 alpha-2
  accreditation    : AccreditationRecord[]
  contact          : VerifierContact
  proposed_scope   : string[]           # Methodology IDs they intend to verify
  application_date : uint64
}
```

### 4.2 Accreditation Requirements

| Requirement | Standard | Renewal |
|-------------|----------|---------|
| ISO 14065 accreditation | Mandatory for all verifiers | Annual |
| Methodology-specific training | Per methodology applied for | Per major version |
| Conflict-of-interest disclosure | Registry policy | Annual |
| Professional liability insurance | Minimum $5M USD | Annual |

### 4.3 ML-DSA-87 Key Ceremony

Upon approval, each verifier organization conducts a key ceremony:

1. Hardware security module (HSM) or SE050 generates ML-DSA-87 key pair
2. Public key registered in the verifier credential store on-lex
3. Key ceremony witnessed by 2-of-3 governance committee members
4. Key fingerprint published to `sc.governance.verifiers.{org_id}.keys`
5. Annual key rotation required; old keys retained for historical verification

---

## 5. Governance Voting

### 5.1 Governance Committee

| Seat | Role | Selection |
|------|------|-----------|
| 1 | Registry Administrator | Appointed by SynergyCarbon operating entity |
| 2 | Independent Expert (Environmental Science) | Nominated and confirmed by committee |
| 3 | Independent Expert (Carbon Markets) | Nominated and confirmed by committee |
| 4 | Independent Expert (Cryptography / Platform) | Nominated and confirmed by committee |
| 5 | Independent Expert (Regulatory / Legal) | Nominated and confirmed by committee |

Committee terms are 2 years, staggered so no more than 2 seats turn over simultaneously.

### 5.2 Voting Protocol

```
ApprovalVote {
  vote_id          : UUID v7
  subject_type     : enum(METHODOLOGY, VERIFIER, POLICY, PARAMETER_CHANGE)
  subject_id       : string             # ID of the item being voted on
  votes            : VoterDecision[]
  threshold        : uint8              # Required yes votes (default: 3)
  quorum           : uint8              # Minimum votes cast (default: 4)
  opened_at        : uint64
  closed_at        : uint64
  result           : enum(APPROVED, REJECTED, NO_QUORUM)
  merkle_ref       : bytes(32)          # Chained into governance_decisions series
}
```

```
VoterDecision {
  voter_id         : account_id         # Committee member
  decision         : enum(YES, NO, ABSTAIN)
  rationale        : string             # Required for NO votes
  timestamp        : uint64
  signature        : ML-DSA-87
}
```

### 5.3 Voting Rules

- **Methodology approval**: 3-of-5 YES votes, minimum 4 votes cast (quorum)
- **Verifier approval**: 3-of-5 YES votes
- **Policy changes**: 4-of-5 YES votes (supermajority)
- **Emergency actions** (e.g., methodology suspension): 3-of-5, no public comment period required
- All votes are signed with the committee member's ML-DSA-87 key
- NO votes must include a written rationale

---

## 6. Graph Model — governance

### 6.1 Node Types

| Node | Description | Key Fields |
|------|-------------|------------|
| `Methodology` | Approved calculation methodology | methodology_id, version, state, content_hash |
| `Verifier` | Credentialed verification organization | org_id, accreditation_status, key_fingerprint |
| `ApprovalVote` | Governance decision record | vote_id, subject_type, result |
| `MethodologyVersion` | Specific version of a methodology | methodology_id, version, supersedes |

### 6.2 Edge Types

| Edge | From → To | Semantics |
|------|-----------|-----------|
| `proposes` | Account → Methodology | Author submits methodology |
| `reviews` | Verifier → Methodology | Organization reviews methodology |
| `votes_on` | Committee Member → ApprovalVote | Member casts vote |
| `approves` | ApprovalVote → Methodology/Verifier | Positive outcome |
| `supersedes` | MethodologyVersion → MethodologyVersion | New version replaces old |

### 6.3 Overlays

| Overlay | Scope | Description |
|---------|-------|-------------|
| `approval_status` | Per-methodology | Current lifecycle state |
| `vote_count` | Per-vote | YES / NO / ABSTAIN tallies |
| `public_comment_count` | Per-methodology (during PUBLIC_COMMENT) | Number of comments received |

### 6.4 Series

**`governance_decisions`**
- Append-only series with Merkle-chaining
- Each entry: `{ vote_id, subject_type, subject_id, result, voter_sigs[], timestamp }`
- PoVC imprint: series root co-signed by all participating committee members
- Provides tamper-evident history of all governance actions

---

## 7. Lex Integration

```
esn/sustainability/carbon/org/synergycarbon/
  governance/
    methodologies/         # Methodology records and versions
    verifiers/             # Verifier registrations and credentials
    votes/                 # Governance vote records
    public-comments/       # Public comment submissions
    decisions/             # Merkle-chained decision series
    policies/              # Platform policy documents
```

---

## 8. Dispute Resolution

When disputes arise (e.g., forward contract delivery disagreements, verification challenges):

1. Disputing party files a dispute request referencing the subject
2. Governance committee assigns a 3-member review panel
3. Panel reviews evidence (attestation data, contract terms, verification records)
4. Panel issues a binding decision (2-of-3 majority)
5. Decision is recorded in the `governance_decisions` series

Disputes must be filed within 90 days of the contested event.

---

## 9. Security Considerations

- **Committee independence**: No single organization may hold more than 1 committee seat
- **Vote integrity**: All votes are ML-DSA-87 signed; vote records are Merkle-chained and cannot be altered retroactively
- **Key compromise recovery**: If a committee member's key is compromised, emergency key rotation requires 3-of-4 remaining members
- **Methodology immutability**: Approved methodology content is SHA3-256 hashed; any modification creates a new version requiring re-approval

---

## References

- [SC-SPEC-001](SC-SPEC-001-verification-pipeline.md) — Verification Pipeline (uses approved methodologies)
- [SC-SPEC-002](SC-SPEC-002-credit-registry.md) — Credit Registry (account policies)
- [SC-SPEC-003](SC-SPEC-003-marketplace.md) — Marketplace (dispute resolution)
- [SC-SPEC-005](SC-SPEC-005-source-adapters.md) — Source Adapters (methodology-specific adapters)
- [DESIGN.md](../DESIGN.md) — Platform design narrative
- ISO 14065:2020 — Requirements for greenhouse gas validation and verification bodies
- ISO 14064-2:2019 — Project-level GHG quantification
