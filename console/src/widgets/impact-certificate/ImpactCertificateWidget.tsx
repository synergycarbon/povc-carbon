/**
 * Impact Certificate Widget
 *
 * @graph   credit_registry — reads the retirement provenance chain from the credit DAG
 * @overlay Retirement certificate: credit details, beneficiary, evidence hash, provenance
 * @rbac    buyer — visible to buyer tier and above; embeddable
 *
 * Renders a visual retirement certificate with:
 * - Credit details (serial, vintage, methodology, tCO2e)
 * - Beneficiary attribution
 * - Evidence hash for provenance verification
 * - Embeddable as standalone iframe
 */

import React from 'react';
import {
  WidgetFrame,
  useWidgetSubscription,
  useEsliteQuery,
  useEStreamTheme,
  useBranding,
} from '@estream/sdk-browser/widgets';
import type { Retirement, CarbonCredit } from '@/types';
import { IMPACT_CERTIFICATE_MANIFEST } from './manifest';

interface ImpactCertificateProps {
  retirement_id?: string;
  credit_id?: string;
}

export function ImpactCertificateWidget({
  retirement_id,
  credit_id,
}: ImpactCertificateProps): React.ReactElement {
  const theme = useEStreamTheme();
  const branding = useBranding();

  const retirement = useEsliteQuery<Retirement>('retirements', {
    where: retirement_id ? { retirement_id } : credit_id ? { credit_id } : undefined,
    limit: 1,
  })?.[0];

  const credit = useEsliteQuery<CarbonCredit>('carbon_credits', {
    where: retirement?.credit_id ? { credit_id: retirement.credit_id } : undefined,
    limit: 1,
  })?.[0];

  return (
    <WidgetFrame manifest={IMPACT_CERTIFICATE_MANIFEST}>
      <div className="sc-certificate" style={{
        background: `linear-gradient(135deg, ${theme.tokens['--es-color-surface']}, white)`,
        border: `2px solid ${theme.tokens['--es-color-primary']}`,
      }}>
        <div className="sc-certificate__header">
          <img
            src={branding.logo?.icon}
            alt={branding.brand?.name}
            className="sc-certificate__logo"
          />
          <h2 className="sc-certificate__title">Carbon Retirement Certificate</h2>
        </div>

        {retirement && credit ? (
          <div className="sc-certificate__body">
            <div className="sc-certificate__amount">
              <span className="sc-certificate__tonnes">{credit.tonnes_co2e.toFixed(4)}</span>
              <span className="sc-certificate__unit">tonnes CO2e</span>
            </div>

            <div className="sc-certificate__details">
              <CertField label="Serial Number" value={credit.serial_number} />
              <CertField label="Vintage" value={String(credit.vintage_year)} />
              <CertField label="Source" value={credit.source_type} />
              <CertField label="Methodology" value={credit.methodology_id} />
              <CertField label="Beneficiary" value={retirement.beneficiary_name} />
              <CertField label="Retirement Date" value={new Date(retirement.retired_at).toLocaleDateString()} />
              <CertField label="Reason" value={retirement.retirement_reason} />
            </div>

            <div className="sc-certificate__verification">
              <span className="sc-certificate__hash">
                Evidence: {toHex(credit.evidence_hash).slice(0, 16)}...
              </span>
            </div>
          </div>
        ) : (
          <div className="sc-certificate__empty">
            No retirement certificate found
          </div>
        )}
      </div>
    </WidgetFrame>
  );
}

function CertField({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="sc-certificate__field">
      <span className="sc-certificate__label">{label}</span>
      <span className="sc-certificate__value">{value}</span>
    </div>
  );
}

function toHex(bytes: Uint8Array | undefined): string {
  if (!bytes) return '—';
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

ImpactCertificateWidget.manifest = IMPACT_CERTIFICATE_MANIFEST;
