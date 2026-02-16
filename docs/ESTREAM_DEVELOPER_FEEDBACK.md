# eStream Developer Experience Feedback

> **From:** SynergyCarbon Engineering
> **Platform:** SynergyCarbon PoVC-Carbon
> **eStream Version:** 0.8.1 + Console Kit (`@estream/sdk-browser/widgets`)
> **Build Scope:** 13 SmartCircuits, 14 Console Kit widgets, full-stack carbon credit platform
> **Date:** 2026-02-15

---

## 1. What Worked Well

### 1.1 ESCIR Declarative Circuit Language

The ESCIR YAML format is the single best architectural decision in eStream from a product developer's perspective. Being able to define an entire SmartCircuit — types, inputs, outputs, compute graph, tests, governance events — in a single declarative file eliminates the impedance mismatch between design and implementation. We defined 13 circuits totaling 6,935 lines of YAML that fully specify the SynergyCarbon platform's business logic without writing a single line of Rust.

**Specific strengths:**
- The two-pattern system (Pattern A: validation-centric, Pattern B: compute-graph) covers every use case we encountered. Our PoVCR Verifier (15 compute nodes) and Forward Contracts engine (29 compute nodes) both mapped cleanly.
- Type definitions are expressive enough for real-world financial and scientific data (we have types for ML-DSA-87 signatures, Merkle proofs, carbon methodology configs).
- The `governance_events` block (v0.8.1) is a simple, elegant way to make every circuit auditable without boilerplate.
- StreamSight annotations make observability a first-class concern rather than an afterthought.

### 1.2 Console Kit Widget Framework

Console Kit transformed what would have been a 6-month frontend build into a 14-widget scaffold that took hours. The framework's opinions are exactly right:

- **`WidgetFrame` + manifest pattern**: Declaring a widget's data needs, roles, and size in a manifest and wrapping the component in `WidgetFrame` is clean and testable. Every widget we built followed the same 30-line pattern.
- **`useWidgetSubscription(topic)`**: Subscribing to lex topics from a React component with a single hook is the correct abstraction. No WebSocket management, no reconnection logic, no message parsing.
- **`useEsliteQuery(table, opts)`**: Local-first querying with the same API regardless of connectivity state. Our widgets work offline because ESLite handles caching transparently.
- **`EStreamThemeProvider` + `branding.yaml`**: Theming via YAML config that resolves to CSS custom properties (`--es-*`) means our entire green palette was configured in one file, not scattered across components.
- **`WidgetGrid` + `WidgetPicker`**: The drag-and-drop grid with RBAC-filtered widget discovery is a complete dashboard solution out of the box.

### 1.3 Spark Wire Protocol Authentication

The post-#551 world where all browser auth flows over WebTransport datagrams is a massive simplification. We defined 8 Spark action gates (retire credits, governance vote, sign contract, etc.) and each one follows the same pattern: the widget declares `spark_actions` in its manifest, Console Kit handles the visual challenge UI, and the ML-DSA-87 signature is transmitted over the wire protocol. No OAuth flows, no token refresh logic, no CORS headers.

### 1.4 WASM-Backed RBAC Data Gateway

The WidgetDataGateway enforcing field-level access control at the WASM layer is architecturally sound. We mapped 4 visibility tiers (public, buyer, auditor, owner) to Console Kit roles, and the gateway strips unauthorized fields before they reach widget code. This means our frontend code never has to check permissions — it simply receives the data it's allowed to see.

### 1.5 WebTransport as the Universal Transport

Having a single transport protocol for everything (auth, data subscriptions, circuit invocations, Spark challenges) eliminates an entire class of infrastructure decisions. We never had to choose between WebSockets, SSE, polling, or gRPC. There is one answer: WebTransport datagrams. This simplicity cascades through the entire codebase.

### 1.6 ESLite WASM Local-First Storage

Defining 11 ESLite table schemas and having the WASM store handle sync, conflict resolution, and offline reads is a significant productivity multiplier. Our carbon credit registry widget works identically whether the user has network connectivity or not — ESLite handles the reconciliation when the connection is restored.

---

## 2. What Could Be Improved

### 2.1 ESCIR v0.8.0 to v0.8.1 Migration

Upgrading 10 circuits from v0.8.0 to v0.8.1 was entirely manual. Each file needed the version bump, new annotation fields (`precision_class`, `resource_metering`), and a new `governance_events` block inserted in the correct location. This is error-prone and tedious.

**Recommendation:** Provide an `escir migrate` CLI command that automates version upgrades. It should add required fields with sensible defaults and validate the result.

### 2.2 ESCIR Schema Validation

There is no schema validator for ESCIR YAML files. We had no way to check whether our circuit definitions were well-formed until runtime. Typos in field names, incorrect type references, and missing required blocks went undetected during authoring.

**Recommendation:** Ship a JSON Schema or YAML schema for ESCIR v0.8.1. Integrate it with VS Code YAML extension for real-time validation. Provide an `escir lint` CLI command.

### 2.3 TypeScript Type Generation from ESCIR

We manually created 276 lines of TypeScript types (`console/src/types/index.ts`) to mirror our ESCIR circuit type definitions. These types must stay in sync with the circuit YAMLs, and there is no automated way to ensure consistency.

**Recommendation:** Provide an `escir codegen --lang typescript` command that generates TS interfaces from ESCIR type definitions. This should be runnable as a build step.

### 2.4 Console Kit Widget Manifest Schema

The `WidgetManifest` TypeScript type is the only documentation for what fields a widget manifest should contain. There is no reference documentation explaining what each field does, what values are valid, or what the behavioral implications are (e.g., how `roles` interacts with the data gateway, how `size` affects the grid).

**Recommendation:** Add a `WIDGETS.md` to the Console Kit documentation with a complete manifest field reference and examples.

### 2.5 Circuit Testing Story

The `tests` block in ESCIR allows declaring test vectors, but there is no CLI tool to execute them. We defined test cases for all 13 circuits but cannot run them without the eStream kernel runtime.

**Recommendation:** Provide an `escir test` command that executes test vectors against a lightweight WASM runtime, without requiring a full eStream node. This would enable CI/CD integration for circuit validation.

### 2.6 ESLite Schema Migration

ESLite table schemas are defined in application code, but there is no migration story for when schemas change. If we add a field to the `carbon_credits` table, there is no documented way to migrate existing cached data.

**Recommendation:** Add schema versioning to ESLite and a migration hook in the provider API.

### 2.7 Console Kit Documentation Discoverability

The Console Kit framework is powerful but under-documented. We relied heavily on the eStream console source code (`apps/console/`) and inline code comments to understand the API. There is no standalone "Console Kit Developer Guide."

**Recommendation:** Create a dedicated Console Kit documentation site or section with tutorials (build your first widget, configure branding, set up RBAC, embed widgets externally).

---

## 3. Upstream Proposals

### 3.1 ESCIR Linter / Validator Tool

**Priority: HIGH**

A standalone `escir` CLI that validates YAML structure, checks type references, verifies compute graph connectivity (no orphan nodes, no cycles), and ensures v0.8.1 compliance. This would be valuable to every eStream circuit author.

### 3.2 TypeScript Codegen from ESCIR

**Priority: HIGH**

An `escir codegen` command that reads circuit YAML and emits TypeScript interfaces for all defined types. Include lex topic string constants and ESLite table names. This eliminates the manual sync burden for Console Kit developers.

### 3.3 Widget Scaffold CLI

**Priority: MEDIUM**

An `estream-dev init --template widget` command (referenced in Console Kit docs but not yet implemented) that generates a widget directory with `manifest.ts`, component TSX, and test file. Should accept parameters for category, roles, lex topics.

### 3.4 Carbon ESF Schema Pack

**Priority: MEDIUM**

SynergyCarbon defines carbon-specific ESF schemas (CarbonCredit, CarbonAttestation, CarbonMint) that would benefit other carbon platforms on eStream. These could be upstreamed as `esf-carbon` — a reusable schema pack analogous to `esf-financial` or `esf-identity`.

### 3.5 Multi-Tenant Widget Data Isolation

**Priority: LOW**

Our platform is multi-tenant (ThermogenZero is the first tenant). Console Kit's data gateway scopes by lex topic pattern, but there is no first-class tenant isolation primitive. We handle this with topic prefixes (`lex://sc/tenants/tz.*`), but a built-in tenant context in the gateway would be cleaner.

### 3.6 Widget-to-Widget Communication

**Priority: LOW**

Some of our widgets need to coordinate (e.g., clicking a credit in the registry widget should open the certificate widget for that credit). There is no built-in widget-to-widget event bus in Console Kit. We would implement this with shared lex topics, but a lightweight client-side event channel would be more appropriate.

### 3.7 Astro Static Site Integration Pattern

**Priority: LOW**

We built the marketing website with Astro (static site generator) alongside the Console Kit SPA. There is no eStream-blessed pattern for combining a static marketing site with a Console Kit console app. We ended up with two separate build pipelines (`website/` for Astro, `console/` for Vite+React). A recommended integration pattern — or an Astro adapter for Console Kit — would help teams ship marketing sites with embedded demo widgets without maintaining two disconnected builds.

### 3.8 Widget Embed SDK for External Sites

**Priority: MEDIUM**

SynergyCarbon's impact widgets (counter, certificate, live meter, leaderboard) need to be embeddable on customer websites outside the Console Kit shell. Currently there is no lightweight embed SDK that loads a single widget with authentication context. We would propose an `@estream/widget-embed` package that provides a `<script>` tag loader with Spark session token injection, similar to how analytics or chat widgets are embedded.

### 3.9 ESZ Demo Fixture Standard

**Priority: MEDIUM**

We created ESZ-format JSON fixtures (`tests/circuits/` and `tests/console/widget_fixtures/`) for circuit validation and console demo mode. These fixtures serve dual purpose: SmartCircuit test vectors and UI demo data. eStream should standardize a `*.esz.json` fixture format specification that includes circuit ID, ESCIR version, tagged test vectors with inputs/expected outputs, and ESLite table seeding metadata. This would allow any eStream application to ship demo mode with `?demo=true` URL activation using a common fixture loader pattern.

### 3.10 Console Kit Demo Mode Toggle

**Priority: MEDIUM**

We implemented a DemoProvider + DemoBanner pattern that intercepts ESLite queries and lex topic subscriptions to return fixture data when demo mode is active. This pattern should be a first-class Console Kit feature: `<ConsoleKit demoFixtures={fixtures} />` that automatically switches between live and demo data sources. The demo banner, URL parameter handling, and fixture loading boilerplate should be provided by `@estream/sdk-browser/demo`.

---

## 4. Summary

eStream is the right foundation for SynergyCarbon. The combination of ESCIR declarative circuits, Console Kit widgets, Spark wire protocol auth, and WebTransport transport allowed us to build a full-stack carbon credit platform — from edge witness nodes to marketplace UI — in a fraction of the time and code that a traditional stack would require. The areas for improvement are tooling and documentation gaps, not architectural shortcomings. The core abstractions are sound.

The additional work on the marketing website, ESZ demo fixtures, and console demo mode surfaced four new upstream opportunities (Sections 3.7–3.10) that would benefit any team building an eStream vertical application with both a marketing presence and interactive demo capabilities.

---

## 5. Upstream Epic Tracking

The upstream proposals from this document have been accepted and tracked in the eStream repository:

- **[#555 — EPIC: Developer Experience](https://github.com/polyquantum/estream-io/issues/555)** — ESCIR Migration CLI, TypeScript Codegen from Circuit Types, JSON Schema for IDE Validation, ESLite Schema Migration, Widget Scaffold CLI, Carbon ESF Schema Pack (`esf-carbon`), Console Kit Developer Guide, ESCIR Test Runner, Widget Event Bus, Multi-Tenant Data Gateway
- **[#556 — EPIC: eStream Website + Platform Impact Case Study](https://github.com/polyquantum/estream-io/issues/556)** — Public estream.io website with testimonials section, platform impact white paper based on SynergyCarbon build metrics
