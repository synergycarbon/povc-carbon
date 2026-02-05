# povc-carbon

**PoVC Carbon Credit Minting** - Cryptographically verified carbon credits on the estream platform.

## Overview

povc-carbon provides the complete infrastructure for minting, managing, and trading carbon credits with hardware-attested Proof of Verifiable Computation (PoVC). Built on the [estream.io](https://estream.io) distributed computing platform.

## Key Features

- **Hardware-Attested Verification** - Carbon credits backed by cryptographic proof from physical sensors
- **ECC-1 Token Standard** - Standardized token schema with full provenance chain
- **Registry Bridges** - Dual-listing to Verra, Gold Standard, ACR, CAR
- **Tiered Visibility** - Compliance-ready access controls for buyers, auditors, owners
- **Automated Retirement** - Trigger-based retirement for B2B integration

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         POVC-CARBON PRODUCT SUITE                        │
│                                                                          │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                    │
│   │  Energy     │  │  Methane    │  │  CO2e       │  PoVC Components   │
│   │  PoVC       │  │  PoVC       │  │ Calculator  │  (Free)            │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                    │
│          └────────────────┼────────────────┘                            │
│                           ▼                                              │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │              Carbon Credit Mint (% of value)                     │   │
│   │              ECC-1 Token Standard                                │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                           │                                              │
│                           ▼                                              │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │              Registry Bridge (Transaction Fee)                   │   │
│   │              Verra | Gold Standard | ACR | CAR                   │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                           │                                              │
│                           ▼                                              │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │              Marketplace (Trading Fees)                          │   │
│   │              Buy | Sell | Retire | Verify                        │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Repository Structure

```
povc-carbon/
├── circuits/                    # ESCIR SmartCircuit definitions
│   ├── sc-energy-povc/         # Energy generation PoVC
│   ├── sc-methane-povc/        # Methane capture PoVC
│   ├── sc-co2e-calculator/     # CO2e emission factor calculations
│   ├── sc-credit-mint/         # Carbon credit minting
│   ├── sc-registry-bridge/     # Registry bridge operations
│   ├── sc-provenance-chain/    # Custody tracking
│   └── sc-auto-retirement/     # Automated retirement triggers
├── token/                       # ECC-1 token standard
│   ├── ECC-1.md                # Token specification
│   └── schema/                 # JSON schema definitions
├── bridges/                     # Registry bridge implementations
│   ├── verra/                  # Verra VCS integration
│   ├── gold-standard/          # Gold Standard integration
│   ├── acr/                    # American Carbon Registry
│   └── car/                    # Climate Action Reserve
├── docs/                        # Documentation
│   ├── SPECIFICATION.md        # Full technical spec
│   ├── IMPLEMENTATION.md       # Implementation guide
│   └── api/                    # API documentation
└── tests/                       # Test suite
```

## SmartCircuits

| Circuit ID | Purpose | Precision Class | Status |
|------------|---------|-----------------|--------|
| `sc-energy-povc` | Verify energy generation | B | Phase 1 |
| `sc-methane-povc` | Verify methane capture | B | Phase 1 |
| `sc-co2e-calculator` | Apply emission factors | C | Phase 2 |
| `sc-credit-mint` | Mint verified credits | C | Phase 3 |
| `sc-registry-bridge` | Bridge to registries | D | Phase 4 |
| `sc-provenance-chain` | Custody tracking | B | Phase 3 |
| `sc-auto-retirement` | Trigger-based retirement | C | Phase 5 |

## ECC-1 Token Standard

```yaml
# estream Carbon Credit (ECC-1)
schema:
  credit_id: string          # Unique identifier
  vintage_year: uint16       # Year of emission reduction
  methodology: string        # EPA, IPCC, Verra VM00xx
  source_type: enum          # TEG, solar, wind, methane_capture
  quantity_co2e: decimal     # Metric tons (6 decimal precision)
  provenance_root: bytes32   # Merkle root of PoVC witnesses
  issuer: string             # Synergy Carbon lex path
  status: enum               # active, retired, cancelled
  retirement_certificate: optional<bytes>
```

## Implementation Timeline

| Phase | Timeline | Deliverable |
|-------|----------|-------------|
| Phase 1 | Q1 2026 | Energy PoVC Component |
| Phase 2 | Q2 2026 | CO2e Calculator |
| Phase 3 | Q3 2026 | Carbon Credit Mint + ECC-1 |
| Phase 4 | Q4 2026 | Verra Registry Bridge |
| Phase 5 | 2027 | Marketplace + Additional Registries |

## First Customer: Thermogen Zero

Thermogen Zero provides the anchor customer with:
- TEG (thermoelectric generator) energy PoVC via [nexus-mppt-hdl](https://github.com/thermogenzero/nexus-mppt-hdl)
- Methane capture PoVC via Zero Methane Vessels
- Multiple wellpad sites for geographic diversity

## estream Platform Integration

This project leverages estream platform features:
- **IsolationAttestation** - Hardware-attested energy readings
- **Cross-Lex Exchange** - Secure token minting
- **Tiered Visibility** - Compliance tier filtering
- **Deployment Framework** - Staged registry rollouts

## Related Repositories

- [thermogenzero/nexus-mppt-hdl](https://github.com/thermogenzero/nexus-mppt-hdl) - TEG-Opti hardware providing energy PoVC
- [synergythermogen/ip](https://github.com/synergythermogen/ip) - IP and patent portfolio

## License

Proprietary - Synergy Carbon, Inc.

## Contact

- Platform: platform@synergycarbon.com
- Engineering: engineering@synergycarbon.com
