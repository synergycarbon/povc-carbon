# Platform Governance — Patent Cross-References

> **Spec Collection:** governance
> **Related Circuits:** `sc.governance.v1`

---

## Patent Applicability

The governance circuit does not directly map to a single patent but supports claims across multiple filings:

| Patent | Relevance | Claims |
|--------|-----------|--------|
| povc-carbon-credit | Methodology governance for carbon credit issuance | Methodology approval workflow, validation rules |
| provenance-chain | Verifier key management in witness verification chain | Verifier registration, key lifecycle, revocation |
| registry-bridge-system | Multi-registry methodology compatibility | Methodology `registry_compatibility` field |
| automated-carbon-retirement | Governance-controlled retirement parameters | Parameter management, threshold governance |

---

## Claim-to-Feature Mapping

### povc-carbon-credit
- **Claim: Methodology-based carbon calculation** → `Methodology` type, `approved_methodologies` state, `methodology_approval` proposal flow
- **Claim: Configurable validation rules** → `ValidationRule` type, automated constraint enforcement

### provenance-chain
- **Claim: Post-quantum witness verification** → ML-DSA-87 governance key requirement, `VerifierRegistration` type
- **Claim: Verifier lifecycle management** → `active | suspended | revoked` status, governance-controlled transitions

### automated-carbon-retirement
- **Claim: Configurable retirement parameters** → `ParameterUpdate` type, governance-controlled threshold changes

---

## Filing Status

All referenced patents are in **Draft** status. Governance features strengthen claims across Cluster B (Carbon Verification) and partially Cluster C (AI & Financial Innovation) where governance controls model parameters.
