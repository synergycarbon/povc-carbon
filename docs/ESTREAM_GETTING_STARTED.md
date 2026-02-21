# Getting Started with eStream — SynergyCarbon (PoVC)

> **eStream SDK**: v0.8.3 (single version model)
> **Date**: February 2026
> **Previous**: eStream v0.8.1 + Console Kit (see [Migration](#migrating-from-v081))

This guide covers how SynergyCarbon developers connect to the eStream platform, write FastLang circuits, test locally, and deploy to the alpha-devnet.

---

## Your FastLang Circuits

SynergyCarbon has 3 production-ready FastLang circuit files in the eStream SDK:

| File | What It Does | Key Features |
|------|-------------|--------------|
| [`povcr_verifier.fl`](https://github.com/polyquantum/estream-io/blob/main/crates/estream-fastlang/examples/synergycarbon/povcr_verifier.fl) | PoVCR measurement verification with witness attestation | `witness threshold(3,5)`, `commitment_create`/`verify`, `fuzz_target`, `kat_vector`, `constant_time` |
| [`methodology.fl`](https://github.com/polyquantum/estream-io/blob/main/crates/estream-fastlang/examples/synergycarbon/methodology.fl) | EPA AP-42 and ISO 14064 emission factor calculation | `methodology epa_ghg`, `methodology iso_14064`, `window_aggregate` |
| [`credit_registry.fl`](https://github.com/polyquantum/estream-io/blob/main/crates/estream-fastlang/examples/synergycarbon/credit_registry.fl) | Carbon credit issue/transfer/retire lifecycle | `transaction`, `escrow_lock`, sub_lex fan_in, `store`, `emit` |

These are the **golden source** for SynergyCarbon's circuit logic. The methodology compliance circuits (`epa_ghg`, `iso_14064`) are formally verifiable through the SMT-LIB codegen backend.

---

## SDK Stack for SynergyCarbon

| Layer | SDK | Package | Use |
|-------|-----|---------|-----|
| **Console Kit** | Widgets | `@estream/console-kit` | 14 pre-built widgets (RBAC, audit trail, credit dashboard) |
| **Browser** | TypeScript SDK | `@estream/sdk-browser` | WebTransport, stream subscribe/emit, Spark auth |
| **ESLite** | Embedded Storage | `eslite` / `eslite-wasm` | 11 table schemas, topic-based event storage, lattice sync |
| **API** | REST + Webhooks | OpenAPI spec | 14 REST endpoints, 8 webhook event types |
| **Observability** | StreamSight | Built-in | ML-DSA-87 attested telemetry |

### Go-Fast Tips

1. **Console Kit widgets are your UI layer** — SynergyCarbon already has 14 Console Kit widgets (3,324 lines). Use `EStreamThemeProvider` and `WidgetDataGateway` instead of building custom React components.

2. **ESLite for audit trails** — Your 11 ESLite table schemas handle carbon credit lifecycle, measurement records, and compliance state. Use `estream eslite query` for local debugging.

3. **Methodology compliance is type-safe** — `methodology.fl` encodes EPA AP-42 and ISO 14064 formulas directly in FastLang. The SMT backend can formally prove your emission factor calculations are correct. Don't hand-roll compliance math.

4. **PoVCR is your differentiator** — Proof of Verified Carbon Reduction uses 3-of-5 witness attestation. The `povcr_verifier.fl` circuit with `constant_time true` and `fuzz_target` is designed to be side-channel resistant and fuzz-tested. Trust it.

5. **Webhooks for B2B integration** — Your 8 webhook event types notify external systems (registry operators, auditors) without polling. Configure via the REST API.

6. **Stream-first, not REST-first** — While you have 14 REST endpoints for B2B, internal communication should use `estream stream emit/subscribe`. REST is the interop layer, not the core.

---

## Testing Locally

### 1. Clone the eStream SDK

```bash
git clone https://github.com/polyquantum/estream-io.git
cd estream-io
```

### 2. Run the FastLang golden tests

```bash
# Compile and test SynergyCarbon circuits
cargo test -p estream-fastlang -- synergycarbon
```

### 3. Start a local devnet

```bash
cargo build --release --bin estream --bin ws-edge

estream localnet start --nodes 3 --with-console
```

### 4. Deploy your circuits

```bash
estream lex compile crates/estream-fastlang/examples/synergycarbon/povcr_verifier.fl
estream lex submit povcr_verifier --lex esn/region/global/org/synergycarbon
```

### 5. Test carbon credit lifecycle

```bash
# Issue a credit
estream stream emit credit_events '{"action":"issue","project_id":"SC-001","tonnes_co2e":100}' \
  --lex esn/region/global/org/synergycarbon

# Verify a measurement
estream stream emit verification_requests '{"measurement_id":"M-001","sensor_hash":"0xabc..."}' \
  --lex esn/region/global/org/synergycarbon

# Watch credit registry
estream stream subscribe credit_events --lex esn/region/global/org/synergycarbon --follow
```

### 6. Formal verification of methodology

```bash
# Prove EPA AP-42 compliance via SMT
estream codegen smt crates/estream-fastlang/examples/synergycarbon/methodology.fl -o methodology.smt2
z3 methodology.smt2
# UNSAT = emission factor calculations are correct
```

### 7. Docker smoke test

```bash
docker compose -f docker/smoke-test/docker-compose.yml up --abort-on-container-exit
```

---

## Alpha-Devnet

The eStream alpha-devnet is coming online (or may already be live) at:

- **Edge**: `wss://edge-alpha-devnet.estream.dev`
- **Console**: `https://console.estream.dev`

To deploy SynergyCarbon circuits:

```bash
estream lex compile crates/estream-fastlang/examples/synergycarbon/povcr_verifier.fl
estream lex submit povcr_verifier \
  --lex esn/region/global/org/synergycarbon \
  --target alpha-devnet \
  --signing-key $SYNERGYCARBON_KEY
```

---

## Migrating from v0.8.1

SynergyCarbon references eStream v0.8.1 + Console Kit. The v0.8.3 SDK is backward-compatible:

| What Changed | Action Required |
|-------------|-----------------|
| **Single version model** | All crates now 0.8.3. Update any Console Kit / SDK version pins |
| **FastLang is canonical** | Your 13 ESCIR circuits should be reviewed against the 3 `.fl` files — these are the golden source going forward |
| **Field governance** | New `field_governance` blocks — controls per-field visibility. Critical for auditor vs. project owner views |
| **Filtered fan-out** | Sub-lex `fan_out` with `share`/`redact` — enables tiered reporting (public summaries vs. detailed auditor data) |
| **Methodology annotations** | New `methodology` annotation in FastLang spec — your EPA/ISO circuits already use this pattern |
| **Annotation codegen** | Rust codegen now generates governance, SLA, streamsight, and witness wrapper types from annotations |

No breaking changes to Console Kit widget API, ESLite schema format, or webhook event types.

---

## Documentation Links

| Document | Where |
|----------|-------|
| [FastLang Quickstart](https://github.com/polyquantum/estream-io/blob/main/docs/guides/FASTLANG_QUICKSTART.md) | Zero to compiled circuit in 15 minutes |
| [App Developer Guide](https://github.com/polyquantum/estream-io/blob/main/docs/guides/FASTLANG_APP_GUIDE.md) | Building app circuits (SynergyCarbon examples included) |
| [Codegen Targets](https://github.com/polyquantum/estream-io/blob/main/docs/guides/CODEGEN_TARGETS.md) | When to use Rust vs SMT for formal verification |
| [SynergyCarbon Examples README](https://github.com/polyquantum/estream-io/blob/main/crates/estream-fastlang/examples/synergycarbon/README.md) | Catalog of all 3 SynergyCarbon .fl files |
| [Security Tier Selection](https://github.com/polyquantum/estream-io/blob/main/docs/guides/security-tier-selection.md) | Choosing witness/privacy/SLA tiers |
