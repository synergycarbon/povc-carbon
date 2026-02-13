# povc-carbon

**SynergyCarbon** — Verified Carbon Credit Platform built on [eStream](https://github.com/toddrooke/estream-io).

PoVC-Carbon is a carbon credit issuance, registry, marketplace, and retirement platform powered by eStream's Proof of Verified Compute (PoVC) attestation protocol. It provides cryptographically verifiable carbon credits backed by real-time hardware telemetry from energy generation sites.

## First Customer

[ThermogenZero](https://github.com/thermogenzero) — thermoelectric hybrid microgrid converting waste methane into electricity and verified carbon credits.

## Documentation

- [DESIGN.md](docs/DESIGN.md) — Platform architecture and PoVCR protocol
- [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — Phased build plan

## Key Concepts

- **PoVCR** (Proof of Verified Compute Result) — quorum-based witness verification for energy production claims
- **Carbon Credit NFT** — ERC-721 compatible token representing verified tCO2e on eStream L2
- **Automated Retirement** — API-driven retirement triggers for B2B integration
- **Tiered Visibility** — audience-based field access (public → buyer → auditor → owner)

## eStream Platform Dependencies

- eStream v0.8.1+ (ESCIR, SmartCircuits, StreamSight)
- `esf-carbon` schema pack (CarbonCredit, CarbonAttestation, CarbonMint)
- `carbon-credit` visibility profile
- eStream marketplace for credit listing
