/**
 * SynergyCarbon Console Kit — Root Application
 *
 * Wraps the widget grid with Console Kit providers:
 * - EStreamThemeProvider: loads branding.yaml, injects --es-* CSS tokens
 * - SparkAuthProvider: wire protocol authentication (WebTransport datagrams)
 * - EsliteProvider: WASM-backed local-first cache
 * - WidgetDataGateway: RBAC-scoped lex topic subscriptions
 */

import React from 'react';
import type {
  EStreamThemeProviderProps,
  WidgetGridProps,
} from '@estream/sdk-browser/widgets';

import {
  EStreamThemeProvider,
  SparkAuthProvider,
  EsliteProvider,
  WidgetDataGateway,
  WidgetGrid,
  WidgetPicker,
  useTransportState,
} from '@estream/sdk-browser/widgets';

import { WIDGET_CATALOG } from './widgets';
import { ESLITE_SCHEMAS } from './eslite/schemas';

const BRANDING_URL = '/branding.yaml';

const TRANSPORT_CONFIG = {
  protocol: 'webtransport' as const,
  endpoint: import.meta.env.VITE_ESTREAM_ENDPOINT ?? 'https://edge.estream.io',
};

export function App(): React.ReactElement {
  return (
    <EStreamThemeProvider brandingUrl={BRANDING_URL}>
      <SparkAuthProvider transport={TRANSPORT_CONFIG}>
        <EsliteProvider schemas={ESLITE_SCHEMAS}>
          <WidgetDataGateway>
            <AppShell />
          </WidgetDataGateway>
        </EsliteProvider>
      </SparkAuthProvider>
    </EStreamThemeProvider>
  );
}

function AppShell(): React.ReactElement {
  const transport = useTransportState();

  return (
    <div className="sc-console">
      <header className="sc-console__header">
        <img
          src="/brand/synergy-carbon/logo/synergy-carbon-logo.svg"
          alt="SynergyCarbon"
          className="sc-console__logo"
        />
        <h1 className="sc-console__title">SynergyCarbon Console</h1>
        <div className="sc-console__status">
          <span
            className={`sc-console__indicator sc-console__indicator--${transport.connected ? 'connected' : 'disconnected'}`}
          />
          {transport.connected ? 'Connected' : 'Connecting...'}
        </div>
      </header>

      <main className="sc-console__main">
        <WidgetGrid widgets={WIDGET_CATALOG}>
          <WidgetPicker />
        </WidgetGrid>
      </main>
    </div>
  );
}
