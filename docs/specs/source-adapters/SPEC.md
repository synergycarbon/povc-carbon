# Source Adapters & Market Expansion Specification

> **Spec Collection:** source-adapters  
> **Implementation Phase:** Phase 9 (Weeks 53-60)  
> **Design Reference:** [DESIGN.md](../../DESIGN.md) Section 2 (Tenant Integrations)  
> **Patent Reference:** [PATENTS.md](PATENTS.md)  
> **Circuit:** `sc.adapters.universal_witness_node.v1` (`circuits/adapters/universal_witness_node.escir.yaml`)  
> **ESCIR Version:** 0.8.1 — universal witness node with 5 source adapters (solar, wind, TEG, biogas, CCS)

---

## 1. Overview

SynergyCarbon is designed as a universal hardware-attested carbon verification infrastructure. The source adapter layer enables onboarding of any energy source type — from TEGs (ThermogenZero, first customer) to large solar/wind farms, biogas/landfill, CCS, and nature-based projects.

The key product enabling market expansion is the **Universal Carbon Witness Node** — a standardized hardware device that can be deployed at any energy or capture site to provide PoVC attestation.

---

## 2. Universal Carbon Witness Node

### 2.1 Hardware Architecture

- **Processing:** FPGA (Lattice ECP5 or equivalent) or secure-element SoC
- **Crypto:** ML-DSA-87 signing, SHA3-256 Merkle tree, VRF witness selection
- **Sensor interfaces:** Configurable I/O for power meters, gas flow sensors, CO2 sensors, soil probes
- **Firmware:** Pluggable methodology firmware — approved via governance
- **Output:** Produces `{source_type}.carbon_minter.v1` lex topic frames
- **Communication:** eStream L2 uplink (cellular, satellite, Ethernet)

### 2.2 Device Identity

- Each node has a unique ML-DSA-87 keypair (PRIME hardware-attested)
- Key registered via governance (same flow as TZ verifier registration)
- Tamper-evident enclosure with physical attestation

### 2.3 Methodology Firmware

Methodology firmware defines how the node measures and calculates carbon impact:

| Firmware | Source Type | Measurement | Calculation |
|----------|-----------|-------------|-------------|
| `fw-teg-methane` | TEG / methane capture | Gas flow + power output | CH4 mass x GWP factor |
| `fw-solar-pv` | Solar PV farm | Inverter power output | Grid displacement x MEF |
| `fw-wind` | Wind farm | SCADA turbine output | Grid displacement x MEF |
| `fw-biogas` | Biogas / landfill gas | Gas flow + CH4 concentration | CH4 destroyed x GWP |
| `fw-ccs` | Carbon capture & storage | CO2 flow at capture + injection | CO2 sequestered |
| `fw-geothermal` | Geothermal power | Generator output | Grid displacement x MEF |
| `fw-hydrogen` | Green hydrogen | Electrolyzer I/O + renewable source | Avoided gray H2 emissions |
| `fw-nature` | Nature-based (soil/biomass) | Soil carbon + biomass sensors | Delta soil C + biomass growth |

Firmware updates require governance approval and are cryptographically signed.

---

## 3. Addressable Markets

### Tier 1: Direct Hardware Measurement (Highest Fit)

#### 3.1 Large Solar Farms

- **Hardware:** Witness node at inverter/combiner box level
- **Measurement:** AC power output, irradiance, panel temperature
- **Methodology:** Grid displacement — actual generation x marginal emission factor (MEF)
- **Causal chain:** Sunlight -> PV cell -> inverter -> grid injection -> avoided fossil generation
- **Market size:** 500+ GW installed US solar capacity

#### 3.2 Large Wind Farms

- **Hardware:** Witness node at turbine SCADA interface or substation
- **Measurement:** Turbine power output, wind speed, capacity factor
- **Methodology:** Grid displacement — actual generation x MEF
- **Causal chain:** Wind -> turbine -> generator -> grid injection -> avoided fossil generation
- **Market size:** 150+ GW installed US wind capacity

#### 3.3 Biogas / Landfill Gas Capture

- **Hardware:** Witness node at gas collection system + power generation
- **Measurement:** CH4 flow rate, gas composition (CH4, CO2, H2S), power output
- **Methodology:** Methane destruction — CH4 captured x destruction efficiency x GWP
- **Causal chain:** Organic decomposition -> CH4 -> capture -> combustion/flare -> power
- **Market size:** 16,000+ US landfills; 2,300+ operational LFG projects
- **Adjacent to TZ:** Nearly identical causal chain (CH4 -> combustion -> power)

#### 3.4 Geothermal Power

- **Hardware:** Witness node at generator/turbine level
- **Measurement:** Power output, wellhead temperature/pressure, flow rate
- **Methodology:** Grid displacement (similar to solar/wind)
- **Causal chain:** Geothermal heat -> steam -> turbine -> generator -> grid
- **Market size:** Emerging; strong in Iceland, Kenya, California

### Tier 2: Methodology Extensions Needed

#### 3.5 Carbon Capture & Storage (CCS)

- **Hardware:** Witness nodes at capture facility + pipeline + injection well
- **Measurement:** CO2 flow rate at capture, pipeline P/T/flow, injection well P/T/saturation
- **Methodology:** CO2 sequestered = captured - leaked - vented (net accounting)
- **Causal chain:** Industrial CO2 -> capture -> transport -> injection -> geological storage
- **Complexity:** Different from energy generation; requires reservoir integrity monitoring
- **Market size:** $100B+ by 2030 (IEA estimate)
- **Regulatory:** EPA Class VI well monitoring requirements align well with PoVC

#### 3.6 Green Hydrogen Production

- **Hardware:** Dual attestation — renewable source witness + electrolyzer witness
- **Measurement:** Renewable input power + H2 output volume + purity
- **Methodology:** Avoided emissions from gray H2 (steam methane reforming baseline)
- **Causal chain:** Renewable power -> electrolyzer -> H2 output -> avoided SMR emissions
- **Complexity:** Requires proving the renewable source (could chain with solar/wind witness)

#### 3.7 Battery Storage / Grid Services

- **Hardware:** Witness node at battery management system / smart meter
- **Measurement:** Charge/discharge cycles, grid frequency response, demand response events
- **Methodology:** Avoided peaker generation — displaced fossil generation during grid stress
- **Regulatory:** FERC Order 2222 creates market opportunity

### Tier 3: Emerging / Hardware-Harder

#### 3.8 EV Charging Networks

- **Hardware:** Witness node at charger level
- **Measurement:** Energy dispensed + source attestation (renewable or grid mix)
- **Methodology:** LCFS credit methodology (California Low Carbon Fuel Standard)
- **Market size:** LCFS credits worth $50-100/ton equivalent

#### 3.9 Nature-Based (Forestry / Agriculture / Soil Carbon)

- **Hardware:** IoT sensor mesh with hardware attestation
- **Measurement:** Soil carbon probes, LiDAR/multispectral biomass estimation, satellite ground truth
- **Methodology:** Delta soil carbon + above-ground biomass growth - disturbance losses
- **Complexity:** Highest uncertainty; PoVC hardware attestation is key differentiator vs. model-only
- **Market size:** $50B+ TAM (largest carbon credit segment)

---

## 4. Tenant Onboarding Flow

1. **Source type registration** — New source type submitted to governance
2. **Methodology approval** — Calculation formula + auditor review + governance vote
3. **Firmware certification** — Witness node firmware tested and approved
4. **Site registration** — Physical site verified, device keys registered
5. **Test period** — 90-day capped volume with enhanced monitoring
6. **Production** — Full credit minting enabled

---

## 5. Per-Source Carbon Minter Interface

Each source type implements a carbon minter circuit producing standardized witness frames:

```yaml
# Standard output interface for all source types
CarbonWitness:
  source_type: string(32)          # "teg", "solar_pv", "wind", "biogas", "ccs"
  site_id: string(64)              # Unique site identifier
  epoch: u64                       # Time epoch
  merkle_root: bytes(32)           # SHA3-256 Merkle root of telemetry
  energy_kwh: f64                  # Energy generated/displaced
  co2e_tonnes: f64                 # Calculated carbon impact
  methodology_id: string(64)       # Applied methodology
  sensor_readings: SensorPayload   # Source-specific raw data
  vrf_proof: bytes(80)             # VRF witness selection proof
  signature: bytes(2420)           # ML-DSA-87 signature
```

Lex topic: `{source_type}.{tenant}.carbon_minter.v1`

---

## 6. Exit Criteria

- Universal witness node hardware spec finalized
- At least 3 methodology firmware images (TEG, solar, biogas) implemented
- Tenant onboarding flow tested with simulated non-TZ sources
- Per-source carbon minter interface standardized
- Governance methodology approval flow operational
