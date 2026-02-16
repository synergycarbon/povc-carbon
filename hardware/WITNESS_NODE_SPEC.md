# Universal Carbon Witness Node — Hardware Specification

> **Version:** 1.0.0
> **Date:** 2026-02-15
> **Circuit:** `sc.adapters.universal_witness_node.v1`
> **Patent References:** universal-carbon-witness-node, modular-containerized-teg-plant
> **Design Reference:** [DESIGN.md](../docs/DESIGN.md) Section 2 (Architecture)

---

## 1. Overview

The Universal Carbon Witness Node is a tamper-resistant edge device that samples energy generation telemetry from diverse sources, signs attestations with post-quantum cryptography, and submits epoch aggregates to the SynergyCarbon PoVCR Verifier via the eStream network.

### 1.1 Design Goals

- **Source-agnostic**: Single hardware platform for all energy source types
- **Tamper-resistant**: Secure boot, hardware key storage, physical tamper detection
- **Low-power**: Operates from site parasitic power (< 15W typical)
- **Connectivity**: Cellular (4G/5G), Wi-Fi, Ethernet, satellite (optional)
- **Post-quantum ready**: ML-DSA-87 signing in hardware secure element

---

## 2. Hardware Architecture

### 2.1 Block Diagram

```
┌──────────────────────────────────────────────────────────┐
│                   Witness Node PCB                        │
│                                                          │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  ARM64  │  │  Secure   │  │ Cellular │  │   GPS    │ │
│  │  SoC    │  │  Element  │  │  Modem   │  │  Module  │ │
│  │ (A76)   │  │  (SE050)  │  │ (4G/5G)  │  │          │ │
│  └────┬────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       │            │              │              │        │
│  ─────┴────────────┴──────────────┴──────────────┴─────  │
│                    Internal Bus (SPI/I2C/UART)            │
│  ─────┬────────────┬──────────────┬──────────────┬─────  │
│       │            │              │              │        │
│  ┌────┴────┐  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐ │
│  │ eMMC   │  │  Sensor   │  │ Ethernet │  │  Status  │ │
│  │ 32GB   │  │  I/O Port │  │  PHY     │  │  LEDs    │ │
│  └────────┘  └──────────┘  └──────────┘  └──────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────────┐│
│  │            Sensor Interface Board (modular)          ││
│  │  RS-485 (Modbus) | RS-232 | 4-20mA | Pulse | GPIO  ││
│  └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

### 2.2 Core Components

| Component | Specification | Purpose |
|-----------|--------------|---------|
| **SoC** | ARM Cortex-A76 (4-core, 2.0 GHz) | eStream kernel runtime, ESCIR execution |
| **RAM** | 2 GB LPDDR4X | Circuit state, telemetry buffer |
| **Storage** | 32 GB eMMC | Firmware, telemetry logs, ESLite cache |
| **Secure Element** | NXP SE050 (or equivalent) | ML-DSA-87 key storage, VRF, signing |
| **Cellular** | Quectel RM520N (5G) / BG96 (4G) | eStream WebTransport uplink |
| **Wi-Fi** | 802.11ac dual-band | Local configuration, fallback uplink |
| **Ethernet** | 10/100/1000 Mbps | Primary wired uplink option |
| **GPS** | u-blox M10 | Timestamping, geolocation verification |
| **Power** | 12-48V DC input, 15W max | Site parasitic power or solar panel |

### 2.3 Sensor Interface Board

The sensor interface is a modular daughter board that connects to the main PCB via a standard 40-pin connector. Source-specific variants:

| Variant | Interfaces | Source Types |
|---------|-----------|--------------|
| **Solar** | RS-485 (Modbus RTU for inverters), pulse (meter) | Solar PV |
| **Wind** | RS-485 (Modbus RTU for SCADA), 4-20mA (anemometer) | Wind turbines |
| **Thermoelectric** | RS-485 (TEG controller), thermocouple (K-type), gas flow (pulse) | TEG/flare |
| **Biogas** | RS-485 (gas analyzer), 4-20mA (flow meter), pulse (generator) | Biogas |
| **CCS** | RS-485 (injection controller), 4-20mA (pressure, flow) | Carbon capture |
| **Universal** | 4x RS-485, 4x 4-20mA, 4x pulse, 8x GPIO | Multi-source |

---

## 3. Software Architecture

### 3.1 Boot Chain

```
ROM Bootloader → U-Boot (verified) → Linux kernel (signed) → eStream kernel → Witness Node circuit
```

- **Secure boot**: All boot stages verified against keys stored in SE050
- **Firmware updates**: OTA via eStream network, dual A/B partitions
- **Rollback protection**: Monotonic counter prevents firmware downgrade

### 3.2 Runtime Stack

| Layer | Component | Description |
|-------|-----------|-------------|
| OS | Linux 6.x (minimal) | Kernel with RT patches, minimal userspace |
| Runtime | eStream kernel | ESCIR circuit execution environment |
| Circuit | `sc.adapters.universal_witness_node.v1` | Witness node logic |
| Crypto | SE050 HAL | Hardware-accelerated ML-DSA-87, VRF, SHA3 |
| Transport | `@estream/transport` | WebTransport over cellular/Wi-Fi/Ethernet |
| Storage | ESLite (WASM) | Local telemetry cache and audit log |

### 3.3 Key Management

- **Witness key pair**: ML-DSA-87 (generated in SE050, private key never leaves hardware)
- **VRF key pair**: Generated in SE050
- **Registration**: Key registered via governance circuit (`sc.governance.v1`)
- **Rotation**: Governance-approved key rotation without physical access
- **Revocation**: Governance can revoke key immediately

---

## 4. Physical Design

### 4.1 Enclosure

| Property | Specification |
|----------|--------------|
| **Rating** | IP67 (outdoor deployment) |
| **Material** | Die-cast aluminum with powder coat |
| **Dimensions** | 180 x 120 x 55 mm |
| **Weight** | ~800g (with sensor board) |
| **Mounting** | DIN rail or wall mount |
| **Operating temp** | -40°C to +85°C |
| **Humidity** | 0-100% RH (non-condensing) |

### 4.2 Tamper Detection

- **Physical tamper switch**: Opens internal contact when enclosure is opened
- **Voltage glitch detection**: Monitors supply rail for injection attacks
- **SE050 tamper mesh**: Hardware key destruction on physical intrusion
- **GPS geofencing**: Alert if node moves outside registered coordinates

### 4.3 Indicators

| LED | Color | Meaning |
|-----|-------|---------|
| Power | Green | System powered |
| Network | Blue (blink) | eStream connected |
| Witness | Green (pulse) | Attestation submitted |
| Error | Red | Fault condition |
| Tamper | Red (solid) | Tamper detected |

---

## 5. Connectivity

### 5.1 Primary: WebTransport

All witness submissions use WebTransport datagrams over HTTP/3 — consistent with the eStream wire protocol (estream-io#551). No HTTP REST fallback.

### 5.2 Uplink Priority

1. **Ethernet** (if available) — lowest latency, highest reliability
2. **Wi-Fi** (if available) — local network uplink
3. **Cellular** (always available) — 4G/5G fallback

### 5.3 Offline Buffer

If all uplinks are unavailable, the node buffers epoch aggregates locally (up to 30 days at 1-hour epochs). Submissions are replayed in order when connectivity is restored.

---

## 6. Power Budget

| Component | Active (mW) | Idle (mW) |
|-----------|-------------|-----------|
| SoC | 3000 | 500 |
| Cellular modem | 4000 | 200 |
| Secure element | 100 | 10 |
| GPS | 150 | 50 |
| Sensors (typical) | 500 | 100 |
| Ethernet PHY | 300 | 50 |
| **Total** | **8050** | **910** |

Average power: ~3W (1-hour epoch cycle with 60s sampling, 50% duty cycle)

---

## 7. Certification Targets

| Standard | Scope |
|----------|-------|
| FCC Part 15 | RF emissions (cellular, Wi-Fi) |
| CE Mark | EU market access |
| IEC 61010 | Safety (measurement equipment) |
| IP67 | Ingress protection |
| ATEX Zone 2 (optional) | Hazardous environment (biogas, CCS) |

---

## 8. Bill of Materials (Estimated)

| Component | Unit Cost (USD) | Notes |
|-----------|----------------|-------|
| SoC module | $35 | ARM64 compute module |
| RAM + eMMC | $15 | 2GB + 32GB |
| Secure element | $8 | NXP SE050C2 |
| Cellular modem | $45 | 5G capable |
| GPS module | $12 | u-blox M10 |
| Sensor interface board | $20 | Source-specific variant |
| Enclosure (IP67) | $25 | Die-cast aluminum |
| PCB + assembly | $30 | 4-layer, SMT |
| Power supply | $10 | 12-48V DC-DC |
| **Total BOM** | **~$200** | At 1000-unit volume |

---

## 9. Cross-References

| Document | Purpose |
|----------|---------|
| [universal_witness_node.escir.yaml](../circuits/adapters/universal_witness_node.escir.yaml) | Edge circuit definition |
| [source-adapters/SPEC.md](../docs/specs/source-adapters/SPEC.md) | Source adapter specification |
| [DESIGN.md](../docs/DESIGN.md) | Master platform design |
| [governance/SPEC.md](../docs/specs/governance/SPEC.md) | Verifier registration process |
| universal-carbon-witness-node (patent) | Hardware IP |
| modular-containerized-teg-plant (patent) | Container deployment reference |
