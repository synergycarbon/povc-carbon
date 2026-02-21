/**
 * Impact Live Meter Widget
 *
 * @graph   verification_pipeline, impact_aggregator — reads live attestation stream + aggregated impact
 * @overlay Current generation rate (kW), running carbon offset (tCO2e), recent attestation feed
 * @rbac    public — no auth required; embeddable
 *
 * Shows real-time energy generation and carbon offset with sub-second
 * updates via graph-backed WebTransport lex topic subscription. Displays:
 * - Current generation rate (kW)
 * - Running carbon offset (tCO2e)
 * - Live attestation feed
 */

import React, { useState, useEffect } from 'react';
import {
  WidgetFrame,
  useWidgetSubscription,
  useEsliteQuery,
  useEStreamTheme,
} from '@estream/sdk-browser/widgets';
import type { Attestation, EntityImpact } from '@/types';
import { IMPACT_LIVE_METER_MANIFEST } from './manifest';

interface ImpactLiveMeterProps {
  entity_id?: string;
}

export function ImpactLiveMeterWidget({ entity_id }: ImpactLiveMeterProps): React.ReactElement {
  const theme = useEStreamTheme();
  const [recentAttestations, setRecentAttestations] = useState<Attestation[]>([]);

  const latestAttestation = useWidgetSubscription<Attestation>(
    'esn://sustainability/carbon/org/synergycarbon/project/{project_id}/verification/attestations/verified',
    { filter: entity_id ? { tenant_id: entity_id } : undefined },
  );

  const impact = useWidgetSubscription<EntityImpact>(
    'esn://sustainability/carbon/org/synergycarbon/registry/impact/updates',
    { filter: entity_id ? { entity_id } : undefined },
  );

  useEffect(() => {
    if (latestAttestation) {
      setRecentAttestations(prev => [latestAttestation, ...prev.slice(0, 9)]);
    }
  }, [latestAttestation]);

  const currentPowerKw = latestAttestation
    ? latestAttestation.total_energy_wh / 1000
    : 0;

  return (
    <WidgetFrame manifest={IMPACT_LIVE_METER_MANIFEST}>
      <div className="sc-live-meter" style={{ color: theme.tokens['--es-color-text'] }}>
        <div className="sc-live-meter__gauge">
          <div className="sc-live-meter__power">
            <span className="sc-live-meter__value">{currentPowerKw.toFixed(1)}</span>
            <span className="sc-live-meter__unit">kW</span>
          </div>
          <div className="sc-live-meter__label">Current Generation</div>
        </div>

        <div className="sc-live-meter__offset">
          <span className="sc-live-meter__offset-value">
            {(impact?.total_tco2e_retired ?? 0).toFixed(4)}
          </span>
          <span className="sc-live-meter__offset-unit">tCO2e total offset</span>
        </div>

        <div className="sc-live-meter__feed">
          <h4 className="sc-live-meter__feed-title">Recent Attestations</h4>
          {recentAttestations.length === 0 ? (
            <div className="sc-live-meter__empty">Waiting for attestations...</div>
          ) : (
            <ul className="sc-live-meter__list">
              {recentAttestations.map((a, i) => (
                <li key={i} className="sc-live-meter__item">
                  <span className="sc-live-meter__item-time">
                    {new Date(a.created_at).toLocaleTimeString()}
                  </span>
                  <span className="sc-live-meter__item-value">
                    {a.tonnes_co2e.toFixed(4)} tCO2e
                  </span>
                  <span className="sc-live-meter__item-confidence">
                    {a.confidence}% conf
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </WidgetFrame>
  );
}

ImpactLiveMeterWidget.manifest = IMPACT_LIVE_METER_MANIFEST;
