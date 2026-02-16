/**
 * Marketplace Widget
 *
 * Provides a full trading interface for carbon credits:
 * - Browse active listings with filters
 * - Real-time price and availability updates
 * - Place orders and cancel listings via Spark actions
 */

import React, { useState, useMemo } from 'react';
import {
  WidgetFrame,
  useWidgetSubscription,
  useEsliteQuery,
  useEStreamTheme,
} from '@estream/sdk-browser/widgets';
import type { MarketplaceListing, SourceType } from '@/types';
import { MARKETPLACE_MANIFEST } from './manifest';

type SortField = 'price_usd' | 'tonnes_co2e' | 'vintage_year' | 'listed_at';

export function MarketplaceWidget(): React.ReactElement {
  const theme = useEStreamTheme();
  const [sortBy, setSortBy] = useState<SortField>('listed_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sourceFilter, setSourceFilter] = useState<SourceType | ''>('');

  useWidgetSubscription<MarketplaceListing>('lex://sc/marketplace/listed');
  useWidgetSubscription<MarketplaceListing>('lex://sc/marketplace/settled');
  useWidgetSubscription<MarketplaceListing>('lex://sc/marketplace/cancelled');

  const listings = useEsliteQuery<MarketplaceListing>('marketplace_listings', {
    where: { status: 'Active' },
    orderBy: 'listed_at',
    order: 'desc',
    limit: 200,
  });

  const filtered = useMemo(() => {
    if (!listings) return [];
    let result = listings;
    if (sourceFilter) {
      result = result.filter(l => l.source_type === sourceFilter);
    }
    result.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return result;
  }, [listings, sourceFilter, sortBy, sortOrder]);

  const totalVolume = filtered.reduce((sum, l) => sum + l.tonnes_co2e, 0);
  const avgPrice = filtered.length
    ? filtered.reduce((sum, l) => sum + l.price_usd, 0) / filtered.length
    : 0;

  function toggleSort(field: SortField): void {
    if (sortBy === field) {
      setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  }

  return (
    <WidgetFrame manifest={MARKETPLACE_MANIFEST}>
      <div className="sc-marketplace" style={{ color: theme.tokens['--es-color-text'] }}>
        <h3 className="sc-marketplace__title">Carbon Credit Marketplace</h3>

        <div className="sc-marketplace__summary">
          <div className="sc-marketplace__metric">
            <span className="sc-marketplace__metric-value">{filtered.length}</span>
            <span className="sc-marketplace__metric-label">Active Listings</span>
          </div>
          <div className="sc-marketplace__metric">
            <span className="sc-marketplace__metric-value">{formatTonnes(totalVolume)}</span>
            <span className="sc-marketplace__metric-label">Total Volume</span>
          </div>
          <div className="sc-marketplace__metric">
            <span className="sc-marketplace__metric-value">${avgPrice.toFixed(2)}</span>
            <span className="sc-marketplace__metric-label">Avg Price/tCO2e</span>
          </div>
        </div>

        <div className="sc-marketplace__filters">
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter((e.target.value || '') as SourceType | '')}
            style={{ background: theme.tokens['--es-color-surface'] }}
          >
            <option value="">All Sources</option>
            <option value="thermoelectric">Thermoelectric</option>
            <option value="solar">Solar</option>
            <option value="wind">Wind</option>
            <option value="biogas">Biogas</option>
            <option value="ccs">CCS</option>
            <option value="geothermal">Geothermal</option>
            <option value="hydro">Hydro</option>
            <option value="nature_based">Nature Based</option>
          </select>
        </div>

        {!filtered.length ? (
          <div className="sc-marketplace__empty">No active listings</div>
        ) : (
          <div className="sc-marketplace__table">
            <div className="sc-marketplace__header">
              <span
                className="sc-marketplace__col-vintage sc-marketplace__sortable"
                onClick={() => toggleSort('vintage_year')}
              >
                Vintage {sortBy === 'vintage_year' ? (sortOrder === 'asc' ? '\u25B2' : '\u25BC') : ''}
              </span>
              <span className="sc-marketplace__col-source">Source</span>
              <span className="sc-marketplace__col-methodology">Methodology</span>
              <span
                className="sc-marketplace__col-tonnes sc-marketplace__sortable"
                onClick={() => toggleSort('tonnes_co2e')}
              >
                tCO2e {sortBy === 'tonnes_co2e' ? (sortOrder === 'asc' ? '\u25B2' : '\u25BC') : ''}
              </span>
              <span
                className="sc-marketplace__col-price sc-marketplace__sortable"
                onClick={() => toggleSort('price_usd')}
              >
                $/tCO2e {sortBy === 'price_usd' ? (sortOrder === 'asc' ? '\u25B2' : '\u25BC') : ''}
              </span>
            </div>

            {filtered.map((listing, idx) => (
              <div key={idx} className="sc-marketplace__row">
                <span className="sc-marketplace__vintage">{listing.vintage_year}</span>
                <span className="sc-marketplace__source">{listing.source_type}</span>
                <span className="sc-marketplace__methodology">{listing.methodology_id}</span>
                <span className="sc-marketplace__tonnes">{listing.tonnes_co2e.toFixed(4)}</span>
                <span className="sc-marketplace__price">${listing.price_usd.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </WidgetFrame>
  );
}

function formatTonnes(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(2);
}

MarketplaceWidget.manifest = MARKETPLACE_MANIFEST;
