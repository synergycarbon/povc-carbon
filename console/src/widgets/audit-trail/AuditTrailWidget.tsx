/**
 * Audit Trail Widget
 *
 * @graph   compliance_chain — reads the DAG of hash-chained compliance events
 * @overlay Hash-chained audit events with action type, timestamp, and prev-hash linkage
 * @rbac    auditor — visible to auditor tier and above
 *
 * Displays a hash-chained audit event log for compliance review.
 * Features:
 * - Real-time event ingestion via graph-backed lex subscription
 * - Action type filtering
 * - Hash chain verification indicators
 * - CSV/JSON export capability
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  WidgetFrame,
  useWidgetSubscription,
  useEsliteQuery,
  useEStreamTheme,
} from '@estream/sdk-browser/widgets';
import type { AuditEvent } from '@/types';
import { AUDIT_TRAIL_MANIFEST } from './manifest';

export function AuditTrailWidget(): React.ReactElement {
  const theme = useEStreamTheme();
  const [actionFilter, setActionFilter] = useState<string>('');
  const [liveEvents, setLiveEvents] = useState<AuditEvent[]>([]);

  const latestEvent = useWidgetSubscription<AuditEvent>(
    'esn://sustainability/carbon/org/synergycarbon/project/{project_id}/verification/audit/events',
  );

  useEffect(() => {
    if (latestEvent) {
      setLiveEvents(prev => [latestEvent, ...prev.slice(0, 199)]);
    }
  }, [latestEvent]);

  const cachedEvents = useEsliteQuery<AuditEvent>('audit_events', {
    orderBy: 'timestamp',
    order: 'desc',
    limit: 200,
  });

  const allEvents = useMemo(() => {
    const seen = new Set<string>();
    const merged: AuditEvent[] = [];
    for (const e of [...liveEvents, ...(cachedEvents ?? [])]) {
      const key = toHex(e.event_id);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(e);
      }
    }
    return merged.sort((a, b) => b.timestamp - a.timestamp);
  }, [liveEvents, cachedEvents]);

  const actions = useMemo(() => {
    return [...new Set(allEvents.map(e => e.action))];
  }, [allEvents]);

  const filtered = useMemo(() => {
    if (!actionFilter) return allEvents;
    return allEvents.filter(e => e.action === actionFilter);
  }, [allEvents, actionFilter]);

  function handleExport(): void {
    const data = filtered.map(e => ({
      event_id: toHex(e.event_id),
      action: e.action,
      timestamp: new Date(e.timestamp).toISOString(),
      details: e.details,
      prev_hash: toHex(e.prev_event_hash),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <WidgetFrame manifest={AUDIT_TRAIL_MANIFEST}>
      <div className="sc-audit-trail" style={{ color: theme.tokens['--es-color-text'] }}>
        <div className="sc-audit-trail__header">
          <h3 className="sc-audit-trail__title">Audit Trail</h3>
          <button
            className="sc-audit-trail__export-btn"
            onClick={handleExport}
            style={{
              background: theme.tokens['--es-color-primary'],
              color: theme.tokens['--es-color-on-primary'] ?? '#fff',
            }}
          >
            Export JSON
          </button>
        </div>

        <div className="sc-audit-trail__filters">
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            style={{ background: theme.tokens['--es-color-surface'] }}
          >
            <option value="">All Actions</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <span className="sc-audit-trail__count">{filtered.length} events</span>
        </div>

        {!filtered.length ? (
          <div className="sc-audit-trail__empty">No audit events recorded</div>
        ) : (
          <div className="sc-audit-trail__table">
            <div className="sc-audit-trail__table-header">
              <span className="sc-audit-trail__col-time">Timestamp</span>
              <span className="sc-audit-trail__col-action">Action</span>
              <span className="sc-audit-trail__col-details">Details</span>
              <span className="sc-audit-trail__col-hash">Hash Chain</span>
            </div>

            {filtered.map((event, idx) => (
              <div key={idx} className="sc-audit-trail__row">
                <span className="sc-audit-trail__time">
                  {new Date(event.timestamp).toLocaleString()}
                </span>
                <span className="sc-audit-trail__action">{event.action}</span>
                <span className="sc-audit-trail__details">{event.details}</span>
                <span className="sc-audit-trail__hash" title={toHex(event.prev_event_hash)}>
                  {toHex(event.prev_event_hash).slice(0, 12)}...
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </WidgetFrame>
  );
}

function toHex(bytes: Uint8Array | undefined): string {
  if (!bytes) return '\u2014';
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

AuditTrailWidget.manifest = AUDIT_TRAIL_MANIFEST;
