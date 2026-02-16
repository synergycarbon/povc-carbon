/**
 * Demo mode fixture loader
 * Loads ESZ-format test fixtures from tests/console/widget_fixtures/
 * and seeds ESLite tables for offline demo rendering.
 */

// Widget fixture imports (resolved at build time via Vite JSON import)
import creditRegistry from '../../../tests/console/widget_fixtures/credit_registry.json';
import attestationMonitor from '../../../tests/console/widget_fixtures/attestation_monitor.json';
import marketplace from '../../../tests/console/widget_fixtures/marketplace.json';
import retirementEngine from '../../../tests/console/widget_fixtures/retirement_engine.json';
import auditTrail from '../../../tests/console/widget_fixtures/audit_trail.json';
import governance from '../../../tests/console/widget_fixtures/governance.json';
import yieldForecast from '../../../tests/console/widget_fixtures/yield_forecast.json';
import forwardContracts from '../../../tests/console/widget_fixtures/forward_contracts.json';
import pricingOracle from '../../../tests/console/widget_fixtures/pricing_oracle.json';
import impactCounter from '../../../tests/console/widget_fixtures/impact_counter.json';
import impactCertificate from '../../../tests/console/widget_fixtures/impact_certificate.json';
import impactLiveMeter from '../../../tests/console/widget_fixtures/impact_live_meter.json';
import impactLeaderboard from '../../../tests/console/widget_fixtures/impact_leaderboard.json';
import riskMonitor from '../../../tests/console/widget_fixtures/risk_monitor.json';

export interface FixtureManifest {
  table: string;
  records: unknown[];
}

/**
 * Returns all fixture data mapped to their ESLite table names.
 * Each entry seeds one ESLite table in demo mode.
 */
export function loadAllFixtures(): FixtureManifest[] {
  return [
    { table: 'carbon_credits', records: creditRegistry.records },
    { table: 'attestations', records: attestationMonitor.records },
    { table: 'marketplace_listings', records: marketplace.records },
    { table: 'retirements', records: retirementEngine.records },
    { table: 'audit_events', records: auditTrail.records },
    { table: 'governance_proposals', records: governance.records },
    { table: 'yield_forecasts', records: yieldForecast.records },
    { table: 'forward_contracts', records: forwardContracts.records },
    { table: 'forward_curves', records: pricingOracle.records },
    { table: 'entity_impacts', records: impactCounter.records },
    { table: 'approved_methodologies', records: [] },
  ];
}

/**
 * Returns fixture data for a specific widget by its lex topic pattern.
 */
export function getFixtureForTopic(topic: string): unknown[] {
  const topicMap: Record<string, unknown[]> = {
    'sc.credits.*': creditRegistry.records,
    'sc.attestations.*': attestationMonitor.records,
    'sc.marketplace.*': marketplace.records,
    'sc.retirements.*': retirementEngine.records,
    'sc.audit.*': auditTrail.records,
    'sc.governance.*': governance.records,
    'sc.ai.forecasts.*': yieldForecast.records,
    'sc.forwards.*': forwardContracts.records,
    'sc.forwards.risk.*': (riskMonitor as any).risk_overlay || [],
    'sc.ai.pricing.*': pricingOracle.records,
    'sc.retirements.completed': impactCounter.records,
    'sc.impact.live': (impactLiveMeter as any).live_data || [],
    'sc.impact.leaderboard': [(impactLeaderboard as any).leaderboard] || [],
    'sc.impact.certificates': (impactCertificate as any).certificates || [],
  };

  // Match by prefix
  for (const [pattern, data] of Object.entries(topicMap)) {
    const prefix = pattern.replace('.*', '');
    if (topic.startsWith(prefix)) {
      return data;
    }
  }
  return [];
}
