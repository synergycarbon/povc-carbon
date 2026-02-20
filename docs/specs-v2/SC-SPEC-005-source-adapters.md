# SC-SPEC-005: Source Adapters

> **Status**: Draft
> **Version**: 2.0.0
> **Date**: 2026-02-20
> **Scope**: Universal witness node hardware, multi-source energy adapters, registry bridges (Verra, Gold Standard, CDM)
> **Platform**: eStream v0.8.3 (PolyQuantum Labs)
> **Compliance**: EPA GHG, ISO 14064, Verra VCS, Gold Standard

---

## 1. Overview

Source Adapters bridge the physical world to the SynergyCarbon verification pipeline. They encompass the hardware witness nodes that perform tamper-resistant measurement, the per-source adapters that normalize diverse energy telemetry into a common attestation format, and the registry bridges that enable cross-listing with established carbon registries.

The adapter layer is designed to be extensible: adding a new energy source type requires a new adapter configuration and methodology mapping, not a platform change.

---

## 2. Universal Carbon Witness Node

### 2.1 Hardware Specification

| Component | Specification |
|-----------|--------------|
| **SoC** | ARM64 (Cortex-A55 or higher), 2GB+ RAM |
| **Secure Element** | NXP SE050 (Common Criteria EAL6+) |
| **Key Storage** | ML-DSA-87 private key generated and stored in SE050; never exported |
| **Connectivity** | Ethernet (primary), LTE Cat-M1 (failover), Wi-Fi (optional) |
| **Power** | PoE (802.3af) or 12V DC; battery backup for 4h attestation continuity |
| **Enclosure** | IP67 rated for outdoor deployment |
| **Sensor Interfaces** | 4x analog (4-20mA), 2x digital (Modbus RTU/TCP), 1x pulse counter |

### 2.2 Boot and Attestation Flow

1. **Secure boot**: Measured boot chain validates firmware integrity; hash stored in SE050
2. **Network join**: Node authenticates to the eStream network via SPARK ceremony using its SE050-resident ML-DSA-87 key
3. **Configuration pull**: Node retrieves its `AdapterConfig` from `sc.adapters.{node_id}.config`
4. **Sampling loop**: Read sensors at methodology-defined interval, construct attestation, sign with SE050, publish to `sc.attestations.{project_id}.raw`
5. **Epoch commit**: At epoch boundary (default 15 min), compute local Merkle root over buffered attestations, publish root

### 2.3 Tamper Detection

- **Physical tamper switch**: Opens circuit on enclosure breach, triggers `TAMPER_ALERT` event
- **Firmware integrity**: Runtime attestation via SE050 hash comparison at each boot and hourly
- **Clock drift**: GPS-disciplined RTC; attestations with > 500ms clock skew are flagged
- **Sensor disconnect**: Loss of analog signal triggers `SENSOR_FAULT` within 5 seconds

---

## 3. Multi-Source Energy Adapters

### 3.1 Adapter Architecture

Each energy source type has a dedicated adapter module that handles:
- Sensor-specific signal interpretation
- Unit conversion to the common attestation format
- Baseline calculation per the applicable methodology
- Calibration coefficient application

```
AdapterConfig {
  adapter_id       : UUID v7
  node_id          : bytes(32)          # Witness Node identity
  source_type      : enum(SOLAR, WIND, BIOGAS, TEG, CCS, GRID_DISPLACEMENT)
  methodology      : string             # Active methodology version
  calibration      : CalibrationParams
  sampling_interval: uint32             # Seconds between readings
  baseline         : BaselineConfig
  unit_map         : Map<sensor_channel, unit>
}
```

### 3.2 Source Types

#### Solar PV

| Parameter | Detail |
|-----------|--------|
| **Sensors** | Irradiance (W/m²), panel temperature (°C), inverter output (kW) |
| **Methodology** | VM0006 grid displacement |
| **Baseline** | Regional grid emission factor (tCO2e/MWh) |
| **Calculation** | `reduction = generation_kwh × grid_factor / 1000` |
| **Sampling** | Every 60 seconds |

#### Wind

| Parameter | Detail |
|-----------|--------|
| **Sensors** | Wind speed (m/s), rotor RPM, generator output (kW) |
| **Methodology** | VM0006 grid displacement |
| **Baseline** | Regional grid emission factor |
| **Calculation** | `reduction = generation_kwh × grid_factor / 1000` |
| **Sampling** | Every 60 seconds |

#### Biogas

| Parameter | Detail |
|-----------|--------|
| **Sensors** | Gas flow rate (m³/h), methane concentration (%), flare/engine status |
| **Methodology** | Gold Standard methane avoidance |
| **Baseline** | Uncontrolled methane release from source (landfill, dairy, etc.) |
| **Calculation** | `reduction = ch4_destroyed_m3 × ch4_gwp × density` |
| **Sampling** | Every 30 seconds |

#### Thermoelectric Generator (TEG)

| Parameter | Detail |
|-----------|--------|
| **Sensors** | Hot-side temperature (°C), cold-side temperature (°C), power output (W), heat flux (W/m²) |
| **Methodology** | EPA AP-42 waste heat recovery |
| **Baseline** | Heat otherwise dissipated without energy recovery |
| **Calculation** | `reduction = power_kwh × grid_factor / 1000` (grid displacement) |
| **Sampling** | Every 15 seconds |
| **First deployment** | ThermogenZero microgrid |

#### Carbon Capture & Storage (CCS)

| Parameter | Detail |
|-----------|--------|
| **Sensors** | CO2 injection rate (kg/h), wellhead pressure (MPa), reservoir temperature (°C) |
| **Methodology** | ISO 14064-2 geological storage |
| **Baseline** | CO2 otherwise released to atmosphere |
| **Calculation** | `reduction = co2_injected_kg / 1000` (direct measurement) |
| **Sampling** | Every 30 seconds |

### 3.3 Calibration

```
CalibrationParams {
  sensor_channel   : uint8
  offset           : float64            # Zero-point correction
  scale_factor     : float64            # Gain correction
  last_calibrated  : uint64             # Unix epoch ms
  calibration_cert : bytes(32)          # Hash of calibration certificate
  next_due         : uint64             # Recalibration deadline
}
```

Calibration certificates are issued by accredited metrology labs and referenced by hash. Expired calibrations cause the adapter to emit `CALIBRATION_OVERDUE` warnings; attestations from uncalibrated sensors are flagged in the verification pipeline (SC-SPEC-001).

### 3.4 Baseline Configuration

```
BaselineConfig {
  baseline_type    : enum(GRID_FACTOR, HISTORICAL_EMISSION, MODELED)
  value            : float64
  unit             : string             # e.g. "tCO2e/MWh"
  source           : string             # e.g. "EPA eGRID 2024 SRSO"
  effective_date   : uint64
  review_interval  : uint32             # Days between baseline updates
}
```

Baselines are methodology-specific and reviewed at the interval defined by the governing methodology version (SC-SPEC-004).

---

## 4. Registry Bridges

Registry bridges enable SynergyCarbon credits to be cross-listed on established carbon registries, expanding market access without sacrificing PoVCR provenance.

### 4.1 Bridge Protocol

```
BridgeRequest {
  bridge_id        : UUID v7
  credit_id        : UUID v7
  target_registry  : enum(VERRA_VCS, GOLD_STANDARD, CDM)
  attestation_hash : bytes(32)          # PoVCR attestation chain root
  credit_metadata  : CreditMetadata     # Project, vintage, methodology, tonnes
  format           : RegistryFormat     # Target-specific format
  status           : enum(PENDING, SUBMITTED, CONFIRMED, REJECTED, SYNCED)
}
```

The bridge converts SynergyCarbon's attestation-backed credit metadata into the target registry's required format while preserving a link back to the PoVCR provenance chain.

### 4.2 Verra VCS Bridge

| Aspect | Detail |
|--------|--------|
| **Integration** | REST API (Verra VCS Registry API v3) |
| **Flow** | Credit issued on SynergyCarbon → bridge submits project registration + monitoring report → Verra issues corresponding VCU |
| **Cross-reference** | SynergyCarbon `credit_id` mapped to Verra VCU serial number |
| **Sync** | Bidirectional: retirement on either registry propagates to the other |
| **Latency** | Verra review cycle: 5-15 business days for initial listing |

### 4.3 Gold Standard Bridge

| Aspect | Detail |
|--------|--------|
| **Integration** | Webhook-based credit mirroring |
| **Flow** | Credit issued → webhook notification to Gold Standard API → GS reviews and mirrors |
| **Cross-reference** | SynergyCarbon `credit_id` mapped to GS VER serial |
| **Sync** | Event-driven: state changes on either side trigger webhook updates |
| **Latency** | Webhook delivery < 30 seconds; GS review cycle varies |

### 4.4 CDM Bridge

| Aspect | Detail |
|--------|--------|
| **Integration** | Batch import/export for legacy CER credits |
| **Flow** | CSV/XML batch upload of legacy CDM credits → SynergyCarbon ingests with provenance flag `LEGACY_CDM` |
| **Cross-reference** | CDM serial number stored as external reference |
| **Sync** | One-way import (CDM → SynergyCarbon); retirement synced manually |
| **Constraints** | Legacy credits cannot claim PoVCR provenance; marked as `REGISTRY_ATTESTED` only |

### 4.5 Double-Count Prevention

Cross-listed credits maintain a `bridge_lock`:
- When a credit is submitted to an external registry, it enters `BRIDGE_LOCKED` state on SynergyCarbon
- The credit cannot be transferred or retired on SynergyCarbon while locked
- Lock is released only if the external registry rejects the submission
- Retirement on either registry triggers retirement on the other via the bridge sync

---

## 5. Graph Model — source_network

### 5.1 Node Types

| Node | Description | Key Fields |
|------|-------------|------------|
| `WitnessNode` | Hardware measurement device | node_id, firmware_hash, location_hash, last_heartbeat |
| `EnergySource` | Physical energy generation or reduction source | source_id, source_type, project_id |
| `RegistryBridge` | Connection to external carbon registry | bridge_id, target_registry, status |
| `AdapterConfig` | Per-node adapter configuration | adapter_id, source_type, methodology, calibration |

### 5.2 Edge Types

| Edge | From → To | Semantics |
|------|-----------|-----------|
| `monitors` | WitnessNode → EnergySource | Node measures this source |
| `adapts` | AdapterConfig → WitnessNode | Configuration applied to node |
| `bridges_to` | Credit → RegistryBridge | Credit cross-listed on external registry |
| `configures` | AdapterConfig → EnergySource | Adapter calibrated for this source type |

### 5.3 Overlays

| Overlay | Scope | Description |
|---------|-------|-------------|
| `source_health` | Per-EnergySource | Composite health score (0.0–1.0) from sensor status, calibration currency, uptime |
| `adapter_status` | Per-WitnessNode | Current adapter state: ACTIVE, CALIBRATION_OVERDUE, SENSOR_FAULT, TAMPER_ALERT |
| `bridge_sync_status` | Per-RegistryBridge | Sync state: IN_SYNC, PENDING, DESYNC (with lag duration) |

---

## 6. Lex Integration

```
esn/sustainability/carbon/org/synergycarbon/
  project/{project_id}/
    adapters/
      nodes/               # Witness Node registrations and heartbeats
      configs/             # Adapter configurations per node
      calibrations/        # Calibration certificates and schedules
      health/              # Source health and adapter status events
  registry/
    bridges/
      verra/               # Verra VCS bridge state and cross-references
      gold-standard/       # Gold Standard bridge state
      cdm/                 # CDM legacy import records
      sync-log/            # Bridge sync events and conflict resolution
```

---

## 7. StreamSight Monitoring

| Metric | Threshold | Alert |
|--------|-----------|-------|
| `node_heartbeat_gap` | > 5 minutes | `WARN` — possible connectivity loss |
| `sensor_fault_rate` | > 5% of readings | `CRITICAL` — hardware issue |
| `calibration_overdue_count` | > 0 | `WARN` — recalibration needed |
| `bridge_sync_lag` | > 24 hours | `WARN` — registry desync |
| `tamper_alert_count` | > 0 | `CRITICAL` — physical security breach |

---

## 8. Deployment: ThermogenZero (First Customer)

ThermogenZero's thermoelectric microgrid is the first production deployment:

| Parameter | Value |
|-----------|-------|
| **Source type** | TEG (thermoelectric generator) |
| **Witness nodes** | 3 nodes per microgrid site |
| **Methodology** | EPA AP-42 waste heat recovery |
| **Sampling interval** | 15 seconds |
| **Estimated annual reduction** | 200-500 tCO2e per site |
| **Registry bridges** | Verra VCS (primary), Gold Standard (secondary) |

---

## 9. Security Considerations

- **Key non-exportability**: ML-DSA-87 private keys are generated inside the SE050 and cannot be read or exported; signing happens on-chip
- **Firmware updates**: Signed firmware images verified by SE050 before flash; rollback protection via monotonic counter
- **Supply chain**: Witness Nodes provisioned with unique identity during manufacturing; device certificate chain rooted in SynergyCarbon's CA
- **Bridge authentication**: Registry API credentials stored in HSM; bridge requests are ML-DSA-87 signed

---

## References

- [SC-SPEC-001](SC-SPEC-001-verification-pipeline.md) — Verification Pipeline (consumes attestations from adapters)
- [SC-SPEC-002](SC-SPEC-002-credit-registry.md) — Credit Registry (issues credits from verified reductions)
- [SC-SPEC-004](SC-SPEC-004-governance.md) — Governance (methodology approval for adapters)
- [DESIGN.md](../DESIGN.md) — Platform design narrative
- NXP SE050 Product Data Sheet
- FIPS 204 — ML-DSA (Module-Lattice Digital Signature Algorithm)
- EPA AP-42: Compilation of Air Pollutant Emissions Factors
- Verra VCS Registry API Documentation
