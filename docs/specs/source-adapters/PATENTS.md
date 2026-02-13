# Source Adapters — Patent Cross-Reference

> **Spec Collection:** source-adapters  
> **Patent Portfolio:** [PORTFOLIO-REVIEW.md](../../../../../synergythermogen/ip/patents/PORTFOLIO-REVIEW.md)

---

## Primary Patents (Cluster D: Market Expansion)

### `universal-carbon-witness-node` — Cluster D (CRITICAL)

**Filing Status:** Draft (New — to be created)  
**Patent Location:** `synergythermogen/ip/patents/universal-carbon-witness-node/` (planned)

| Patent Claim | Platform Feature | Hardware / Code |
|-------------|-----------------|-----------------|
| Source-agnostic attestation hardware | Universal witness node with pluggable sensor I/O | FPGA/SoC hardware design |
| ML-DSA-87 signing + SHA3-256 Merkle + VRF on single device | Onboard crypto for PoVC attestation | Hardware crypto accelerator |
| Pluggable methodology firmware | Governance-approved firmware images (TEG, solar, biogas, CCS) | Firmware update protocol |
| Configurable sensor interfaces | Power meters, gas flow, CO2, soil probes | Hardware I/O modules |
| Standard `{source_type}.carbon_minter.v1` output | Unified CarbonWitness frame across all sources | ESF frame encoder |
| Secure firmware update with governance validation | Signed firmware + governance circuit approval | `governance` — firmware_approval node |
| PRIME hardware-attested device identity | Per-node ML-DSA-87 keypair bound to hardware | T0/TSSP attestation |

### `biogas-povc-attestation` — Cluster D (HIGH)

**Filing Status:** Draft (New — to be created)  
**Patent Location:** `synergythermogen/ip/patents/biogas-povc-attestation/` (planned)

| Patent Claim | Platform Feature | Hardware / Code |
|-------------|-----------------|-----------------|
| PoVC for biogas/landfill CH4 | Methane flow + capture + destruction verification | `fw-biogas` firmware |
| Anaerobic digestion monitoring | Temperature, pH, biogas composition attestation | Sensor interface module |
| Methane destruction efficiency (>99%) | Continuous destruction rate calculation | Carbon calculation engine |
| Cross-reference with LFG collection telemetry | Landfill gas system integration | Data correlation node |

### `ccs-sequestration-verification` — Cluster D (HIGH)

**Filing Status:** Draft (New — to be created)  
**Patent Location:** `synergythermogen/ip/patents/ccs-sequestration-verification/` (planned)

| Patent Claim | Platform Feature | Hardware / Code |
|-------------|-----------------|-----------------|
| Hardware-attested CO2 capture monitoring | CO2 flow measurement at capture facility | `fw-ccs` firmware (capture module) |
| Pipeline transport monitoring | Pressure/temperature/flow attestation along pipeline | `fw-ccs` firmware (transport module) |
| Injection well monitoring | P/T/saturation at injection point | `fw-ccs` firmware (injection module) |
| Reservoir integrity proof | Continuous pressure monitoring for leakage detection | Subsurface sensor mesh |
| EPA Class VI compliance alignment | Monitoring meets regulatory requirements | Compliance export format |

### `grid-displacement-carbon-methodology` — Cluster D (MEDIUM)

**Filing Status:** Draft (New — to be created)  
**Patent Location:** `synergythermogen/ip/patents/grid-displacement-carbon-methodology/` (planned)

| Patent Claim | Platform Feature | Hardware / Code |
|-------------|-----------------|-----------------|
| Real-time marginal emission factor calculation | Grid MEF from data feeds + attestation | `fw-solar-pv`, `fw-wind` firmware |
| Hardware-attested power generation at inverter/SCADA level | Witness node at generation equipment | Universal witness node |
| Dynamic carbon intensity by time-of-generation | Peak vs. off-peak displacement value weighting | Carbon calculation engine |
| Grid interconnection point measurement | Power exported to grid (net of parasitic load) | Meter interface module |

### `nature-based-carbon-sensing` — Cluster D (MEDIUM)

**Filing Status:** Draft (New — to be created)  
**Patent Location:** `synergythermogen/ip/patents/nature-based-carbon-sensing/` (planned)

| Patent Claim | Platform Feature | Hardware / Code |
|-------------|-----------------|-----------------|
| Hardware-attested soil carbon sensors | PoVC verification of soil carbon measurements | `fw-nature` firmware |
| Satellite ground truth correlation | On-site sensor data validates satellite estimates | Correlation algorithm |
| Biomass estimation with hardware attestation | LiDAR/multispectral + ground truth sensors | Biomass estimation module |
| Continuous monitoring vs. periodic sampling | Always-on measurement vs. annual audits | Continuous data stream |
| Sensor network mesh with peer attestation | Multiple sensors cross-validate each other | Mesh attestation protocol |

---

## Supporting Patents (Cluster A: Hardware)

### `teg-mppt-optimization` — Cluster A (HIGH)

**Relevance:** Source-agnostic MPPT claims (TEG, PV, wind) directly support the universal witness node. The per-module FPGA-based MPPT is the first implementation of the witness node pattern.

### `modular-containerized-teg-plant` — Cluster A (HIGH)

**Relevance:** Containerized deployment pattern extends to witness nodes at solar/wind/biogas sites. Standard form factor for rapid deployment.

### `thermoelectric-black-start` — Cluster A (HIGH)

**Relevance:** Self-powered boot capability is essential for remote witness nodes (off-grid landfills, wellpads, nature-based sites).

### `hybrid-heat-source-teg` — Cluster A (MEDIUM)

**Relevance:** Multi-source heat integration patent supports the per-source carbon attribution methodology.
