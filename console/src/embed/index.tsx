/**
 * SynergyCarbon Impact Widget — Standalone Embed Routes
 *
 * These routes allow embedding individual impact widgets via iframe:
 *
 *   <iframe src="https://console.synergycarbon.io/embed/impact-counter?entity_id=..."/>
 *   <iframe src="https://console.synergycarbon.io/embed/impact-certificate?retirement_id=..."/>
 *   <iframe src="https://console.synergycarbon.io/embed/impact-live-meter?entity_id=..."/>
 *   <iframe src="https://console.synergycarbon.io/embed/impact-leaderboard?max_entries=10"/>
 *
 * Each embed route renders the widget standalone with minimal chrome
 * and transparent background for seamless integration into third-party sites.
 */

import React from 'react';
import {
  EStreamThemeProvider,
  SparkAuthProvider,
  EsliteProvider,
  WidgetDataGateway,
} from '@estream/sdk-browser/widgets';
import { ESLITE_SCHEMAS } from '@/eslite/schemas';
import { ImpactCounterWidget } from '@/widgets/impact-counter/ImpactCounterWidget';
import { ImpactCertificateWidget } from '@/widgets/impact-certificate/ImpactCertificateWidget';
import { ImpactLiveMeterWidget } from '@/widgets/impact-live-meter/ImpactLiveMeterWidget';
import { ImpactLeaderboardWidget } from '@/widgets/impact-leaderboard/ImpactLeaderboardWidget';

const BRANDING_URL = '/branding.yaml';
const TRANSPORT_CONFIG = {
  protocol: 'webtransport' as const,
  endpoint: import.meta.env.VITE_ESTREAM_ENDPOINT ?? 'https://edge.estream.io',
};

interface EmbedWrapperProps {
  children: React.ReactNode;
}

function EmbedWrapper({ children }: EmbedWrapperProps): React.ReactElement {
  return (
    <EStreamThemeProvider brandingUrl={BRANDING_URL}>
      <SparkAuthProvider transport={TRANSPORT_CONFIG}>
        <EsliteProvider schemas={ESLITE_SCHEMAS}>
          <WidgetDataGateway>
            <div className="sc-embed" style={{ background: 'transparent', padding: '8px' }}>
              {children}
            </div>
          </WidgetDataGateway>
        </EsliteProvider>
      </SparkAuthProvider>
    </EStreamThemeProvider>
  );
}

export function EmbedImpactCounter(): React.ReactElement {
  const params = new URLSearchParams(window.location.search);
  return (
    <EmbedWrapper>
      <ImpactCounterWidget entity_id={params.get('entity_id') ?? undefined} />
    </EmbedWrapper>
  );
}

export function EmbedImpactCertificate(): React.ReactElement {
  const params = new URLSearchParams(window.location.search);
  return (
    <EmbedWrapper>
      <ImpactCertificateWidget
        retirement_id={params.get('retirement_id') ?? undefined}
        credit_id={params.get('credit_id') ?? undefined}
      />
    </EmbedWrapper>
  );
}

export function EmbedImpactLiveMeter(): React.ReactElement {
  const params = new URLSearchParams(window.location.search);
  return (
    <EmbedWrapper>
      <ImpactLiveMeterWidget entity_id={params.get('entity_id') ?? undefined} />
    </EmbedWrapper>
  );
}

export function EmbedImpactLeaderboard(): React.ReactElement {
  const params = new URLSearchParams(window.location.search);
  const maxEntries = parseInt(params.get('max_entries') ?? '25', 10);
  return (
    <EmbedWrapper>
      <ImpactLeaderboardWidget max_entries={maxEntries} />
    </EmbedWrapper>
  );
}

export const EMBED_ROUTES = {
  '/embed/impact-counter': EmbedImpactCounter,
  '/embed/impact-certificate': EmbedImpactCertificate,
  '/embed/impact-live-meter': EmbedImpactLiveMeter,
  '/embed/impact-leaderboard': EmbedImpactLeaderboard,
} as const;
