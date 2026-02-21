/**
 * Attestation Monitor Widget
 *
 * @graph   verification_pipeline — reads the DAG of attestation verification steps
 * @overlay Attestation status (verified/rejected), confidence scores, quorum counts
 * @rbac    auditor — visible to auditor tier and above
 *
 * Real-time feed of verified and rejected attestations for auditors.
 * Subscribes to graph-backed verification lex topics and maintains a rolling
 * window of recent events with confidence scoring.
 */

import React, { useState, useEffect } from 'react';
import {
  WidgetFrame,
  useWidgetSubscription,
  useEsliteQuery,
  useEStreamTheme,
} from '@estream/sdk-browser/widgets';
import type { Attestation } from '@/types';
import { ATTESTATION_MONITOR_MANIFEST } from './manifest';

interface AttestationEvent {
  attestation: Attestation;
  status: 'verified' | 'rejected';
}

export function AttestationMonitorWidget(): React.ReactElement {
  const theme = useEStreamTheme();
  const [events, setEvents] = useState<AttestationEvent[]>([]);

  const latestVerified = useWidgetSubscription<Attestation>(
    'esn://sustainability/carbon/org/synergycarbon/project/{project_id}/verification/attestations/verified',
  );
  const latestRejected = useWidgetSubscription<Attestation>(
    'esn://sustainability/carbon/org/synergycarbon/project/{project_id}/verification/attestations/rejected',
  );

  const cachedAttestations = useEsliteQuery<Attestation>('attestations', {
    orderBy: 'created_at',
    order: 'desc',
    limit: 50,
  });

  useEffect(() => {
    if (latestVerified) {
      setEvents(prev => [
        { attestation: latestVerified, status: 'verified' },
        ...prev.slice(0, 49),
      ]);
    }
  }, [latestVerified]);

  useEffect(() => {
    if (latestRejected) {
      setEvents(prev => [
        { attestation: latestRejected, status: 'rejected' },
        ...prev.slice(0, 49),
      ]);
    }
  }, [latestRejected]);

  const verifiedCount = events.filter(e => e.status === 'verified').length;
  const rejectedCount = events.filter(e => e.status === 'rejected').length;

  return (
    <WidgetFrame manifest={ATTESTATION_MONITOR_MANIFEST}>
      <div className="sc-attestation-monitor" style={{ color: theme.tokens['--es-color-text'] }}>
        <h3 className="sc-attestation-monitor__title">Attestation Monitor</h3>

        <div className="sc-attestation-monitor__stats">
          <div className="sc-attestation-monitor__stat">
            <span
              className="sc-attestation-monitor__stat-value"
              style={{ color: theme.tokens['--es-color-success'] ?? '#22c55e' }}
            >
              {verifiedCount}
            </span>
            <span className="sc-attestation-monitor__stat-label">Verified</span>
          </div>
          <div className="sc-attestation-monitor__stat">
            <span
              className="sc-attestation-monitor__stat-value"
              style={{ color: theme.tokens['--es-color-error'] ?? '#ef4444' }}
            >
              {rejectedCount}
            </span>
            <span className="sc-attestation-monitor__stat-label">Rejected</span>
          </div>
          <div className="sc-attestation-monitor__stat">
            <span className="sc-attestation-monitor__stat-value">
              {cachedAttestations?.length ?? 0}
            </span>
            <span className="sc-attestation-monitor__stat-label">Cached</span>
          </div>
        </div>

        <div className="sc-attestation-monitor__feed">
          {events.length === 0 ? (
            <div className="sc-attestation-monitor__empty">
              Waiting for attestation events...
            </div>
          ) : (
            <ul className="sc-attestation-monitor__list">
              {events.map((event, idx) => (
                <li
                  key={idx}
                  className="sc-attestation-monitor__item"
                  style={{
                    borderLeft: `3px solid ${
                      event.status === 'verified'
                        ? theme.tokens['--es-color-success'] ?? '#22c55e'
                        : theme.tokens['--es-color-error'] ?? '#ef4444'
                    }`,
                  }}
                >
                  <span className="sc-attestation-monitor__item-time">
                    {new Date(event.attestation.created_at).toLocaleTimeString()}
                  </span>
                  <span className="sc-attestation-monitor__item-tonnes">
                    {event.attestation.tonnes_co2e.toFixed(4)} tCO2e
                  </span>
                  <span className="sc-attestation-monitor__item-confidence">
                    {event.attestation.confidence}% conf
                  </span>
                  <span className="sc-attestation-monitor__item-quorum">
                    Q:{event.attestation.quorum_count}
                  </span>
                  <span className={`sc-attestation-monitor__item-status sc-attestation-monitor__item-status--${event.status}`}>
                    {event.status}
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

AttestationMonitorWidget.manifest = ATTESTATION_MONITOR_MANIFEST;
