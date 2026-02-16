import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

/* ---- Fixture imports ---- */
import credits from '../../tests/console/widget_fixtures/credit_registry.json';
import attestations from '../../tests/console/widget_fixtures/attestation_monitor.json';
import listings from '../../tests/console/widget_fixtures/marketplace.json';
import retirements from '../../tests/console/widget_fixtures/retirement_engine.json';
import auditEvents from '../../tests/console/widget_fixtures/audit_trail.json';
import governance from '../../tests/console/widget_fixtures/governance.json';
import forecasts from '../../tests/console/widget_fixtures/yield_forecast.json';
import contracts from '../../tests/console/widget_fixtures/forward_contracts.json';
import riskData from '../../tests/console/widget_fixtures/risk_monitor.json';
import pricing from '../../tests/console/widget_fixtures/pricing_oracle.json';
import impacts from '../../tests/console/widget_fixtures/impact_counter.json';
import certificates from '../../tests/console/widget_fixtures/impact_certificate.json';
import liveMeter from '../../tests/console/widget_fixtures/impact_live_meter.json';
import leaderboard from '../../tests/console/widget_fixtures/impact_leaderboard.json';

/* ---- Styles ---- */
const DARK = '#0a0a0a';
const SURFACE = '#141414';
const BORDER = '#222';
const GREEN = '#22c55e';
const GREEN_DIM = '#16a34a';
const TEXT = '#e5e5e5';
const MUTED = '#888';

const css = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Inter',system-ui,sans-serif; background:${DARK}; color:${TEXT}; }
  .console { display:flex; flex-direction:column; min-height:100vh; }
  .header { display:flex; align-items:center; gap:1rem; padding:0.75rem 1.5rem; background:${SURFACE}; border-bottom:1px solid ${BORDER}; }
  .header h1 { font-size:1.1rem; font-weight:600; }
  .demo-badge { background:${GREEN}; color:#000; padding:0.2rem 0.6rem; border-radius:4px; font-size:0.7rem; font-weight:700; }
  .status { margin-left:auto; display:flex; align-items:center; gap:0.5rem; font-size:0.8rem; color:${MUTED}; }
  .dot { width:8px; height:8px; border-radius:50%; background:${GREEN}; animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .tabs { display:flex; gap:0; border-bottom:1px solid ${BORDER}; background:${SURFACE}; padding:0 1rem; overflow-x:auto; }
  .tab { padding:0.6rem 1.2rem; font-size:0.8rem; color:${MUTED}; cursor:pointer; border-bottom:2px solid transparent; white-space:nowrap; transition:all 0.2s; }
  .tab:hover { color:${TEXT}; }
  .tab.active { color:${GREEN}; border-bottom-color:${GREEN}; }
  .main { flex:1; padding:1.5rem; overflow-y:auto; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:1rem; }
  .card { background:${SURFACE}; border:1px solid ${BORDER}; border-radius:10px; padding:1.25rem; transition:border-color 0.2s; }
  .card:hover { border-color:${GREEN_DIM}; }
  .card h3 { font-size:0.85rem; color:${MUTED}; margin-bottom:0.75rem; text-transform:uppercase; letter-spacing:0.05em; }
  .stat-row { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:0.25rem; }
  .stat-val { font-size:1.8rem; font-weight:700; color:${GREEN}; }
  .stat-label { font-size:0.75rem; color:${MUTED}; }
  .table-wrap { overflow-x:auto; }
  table { width:100%; border-collapse:collapse; font-size:0.8rem; }
  th { text-align:left; padding:0.5rem 0.75rem; color:${MUTED}; font-weight:500; border-bottom:1px solid ${BORDER}; white-space:nowrap; }
  td { padding:0.5rem 0.75rem; border-bottom:1px solid #1a1a1a; white-space:nowrap; }
  .badge { padding:0.15rem 0.5rem; border-radius:10px; font-size:0.7rem; font-weight:600; display:inline-block; }
  .badge-green { background:rgba(34,197,94,0.15); color:${GREEN}; }
  .badge-blue { background:rgba(59,130,246,0.15); color:#3b82f6; }
  .badge-purple { background:rgba(168,85,247,0.15); color:#a855f7; }
  .badge-orange { background:rgba(249,115,22,0.15); color:#f97316; }
  .badge-red { background:rgba(239,68,68,0.15); color:#ef4444; }
  .badge-yellow { background:rgba(234,179,8,0.15); color:#eab308; }
  .wide { grid-column: span 2; }
  @media(max-width:768px) { .wide { grid-column: span 1; } }
  .meter { display:flex; align-items:center; gap:1rem; margin-bottom:1rem; }
  .meter-circle { width:80px; height:80px; border-radius:50%; border:4px solid ${GREEN}; display:flex; align-items:center; justify-content:center; flex-direction:column; }
  .meter-val { font-size:1rem; font-weight:700; color:${GREEN}; }
  .meter-unit { font-size:0.6rem; color:${MUTED}; }
  .bar { height:6px; border-radius:3px; background:#1a1a1a; margin:0.5rem 0; }
  .bar-fill { height:100%; border-radius:3px; background:${GREEN}; transition:width 0.8s ease; }
  .leaderboard-row { display:flex; align-items:center; gap:0.75rem; padding:0.5rem 0; border-bottom:1px solid #1a1a1a; }
  .rank { width:24px; height:24px; border-radius:50%; background:#1a1a1a; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:700; }
  .rank-1 { background:#fbbf24; color:#000; }
  .rank-2 { background:#94a3b8; color:#000; }
  .rank-3 { background:#cd7f32; color:#000; }
  .lb-name { flex:1; font-size:0.85rem; }
  .lb-val { font-weight:600; color:${GREEN}; font-size:0.85rem; }
`;

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    Issued: 'badge-green', Listed: 'badge-blue', Sold: 'badge-purple',
    Retired: 'badge-orange', Cancelled: 'badge-red', Active: 'badge-green',
    Filled: 'badge-purple', Expired: 'badge-yellow', Proposed: 'badge-blue',
    Delivering: 'badge-green', Settled: 'badge-purple', Defaulted: 'badge-red',
    approved: 'badge-green', rejected: 'badge-red', pending: 'badge-yellow', expired: 'badge-yellow',
  };
  return map[status] || 'badge-blue';
};

const fmt = (n: number, d = 1) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const ts = (epoch: number) => new Date(epoch * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

type Tab = 'dashboard' | 'registry' | 'marketplace' | 'impact' | 'audit' | 'governance' | 'ai' | 'contracts';

function Dashboard() {
  const totalIssued = credits.records.length;
  const totalRetired = retirements.records.reduce((s, r: any) => s + r.tonnes_co2e, 0);
  const activeListings = listings.records.filter((l: any) => l.status === 'Active').length;
  const totalVolume = listings.records.reduce((s, l: any) => s + l.price_usd * l.tonnes_co2e, 0);

  return (
    <div className="grid">
      <div className="card"><h3>Credits Issued</h3><div className="stat-val">{totalIssued}</div><div className="stat-label">total carbon credits minted</div></div>
      <div className="card"><h3>tCO2e Retired</h3><div className="stat-val">{fmt(totalRetired)}</div><div className="stat-label">tonnes CO2 equivalent</div></div>
      <div className="card"><h3>Active Listings</h3><div className="stat-val">{activeListings}</div><div className="stat-label">marketplace listings</div></div>
      <div className="card"><h3>Market Volume</h3><div className="stat-val">${fmt(totalVolume, 0)}</div><div className="stat-label">total listing value</div></div>

      {(liveMeter as any).live_data?.map((m: any) => (
        <div className="card" key={m.entity_id}>
          <h3>Live Meter — {m.source_type}</h3>
          <div className="meter">
            <div className="meter-circle"><div className="meter-val">{fmt(m.current_power_w, 0)}</div><div className="meter-unit">watts</div></div>
            <div style={{flex:1}}>
              <div className="stat-row"><span className="stat-label">Rate</span><span>{fmt(m.current_rate_tco2e_per_hour, 4)} tCO2e/hr</span></div>
              <div className="stat-row"><span className="stat-label">Today</span><span>{fmt(m.today_tco2e, 3)} tCO2e</span></div>
              <div className="stat-row"><span className="stat-label">Lifetime</span><span>{fmt(m.lifetime_tco2e)} tCO2e</span></div>
            </div>
          </div>
        </div>
      ))}

      <div className="card">
        <h3>Yield Forecast — tz-wellpad-alpha-01</h3>
        {forecasts.records.filter((f: any) => f.project_id === 'tz-wellpad-alpha-01').map((f: any) => (
          <div key={f.horizon} className="stat-row" style={{marginBottom:'0.5rem'}}>
            <span className="stat-label">{f.horizon}</span>
            <span style={{color:GREEN,fontWeight:600}}>{fmt(f.point_estimate)} tCO2e</span>
            <span style={{fontSize:'0.7rem',color:MUTED}}>({fmt(f.confidence_lower)} — {fmt(f.confidence_upper)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Registry() {
  return (
    <div className="grid">
      <div className="card wide">
        <h3>Credit Registry</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Serial</th><th>Project</th><th>Source</th><th>Methodology</th><th>Vintage</th><th>tCO2e</th><th>Status</th><th>Issued</th></tr></thead>
            <tbody>
              {credits.records.map((c: any) => (
                <tr key={c.credit_id}>
                  <td style={{fontFamily:'monospace',fontSize:'0.75rem'}}>{c.serial_number}</td>
                  <td>{c.project_name}</td>
                  <td>{c.source_type}</td>
                  <td>{c.methodology_id}</td>
                  <td>{c.vintage_year}</td>
                  <td>{fmt(c.tonnes_co2e, 3)}</td>
                  <td><span className={`badge ${statusBadge(c.status)}`}>{c.status}</span></td>
                  <td>{ts(c.issued_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Marketplace() {
  return (
    <div className="grid">
      {listings.records.map((l: any) => (
        <div className="card" key={l.listing_id}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}}>
            <span className={`badge ${statusBadge(l.status)}`}>{l.status}</span>
            <span style={{fontSize:'0.7rem',color:MUTED}}>{l.methodology_id}</span>
          </div>
          <div style={{fontSize:'1.5rem',fontWeight:700,color:GREEN,marginBottom:'0.25rem'}}>${fmt(l.price_usd, 2)} <span style={{fontSize:'0.8rem',color:MUTED}}>/tonne</span></div>
          <div style={{fontSize:'0.85rem',marginBottom:'0.75rem'}}>{l.tonnes_co2e} tCO2e — {l.source_type} ({l.vintage_year})</div>
          <div className="bar"><div className="bar-fill" style={{width: l.status === 'Active' ? '100%' : '0%'}}/></div>
          <div style={{fontSize:'0.75rem',color:MUTED}}>Seller: {l.seller} &middot; Listed {ts(l.listed_at)}</div>
        </div>
      ))}
      <div className="card">
        <h3>Forward Pricing</h3>
        <div style={{fontSize:'1.4rem',fontWeight:700,color:GREEN,marginBottom:'0.5rem'}}>Spot: ${fmt(pricing.records[0].spot_price_usd, 2)}</div>
        {pricing.records[0].curve.map((p: any) => (
          <div key={p.tenor_months} className="stat-row" style={{marginBottom:'0.4rem'}}>
            <span className="stat-label">{p.tenor_months}M</span>
            <span style={{fontWeight:600}}>${fmt(p.price_usd, 2)}</span>
            <span style={{fontSize:'0.7rem',color:MUTED}}>&plusmn;${fmt(p.confidence_interval, 2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Impact() {
  const lb = (leaderboard as any).leaderboard;
  return (
    <div className="grid">
      <div className="card">
        <h3>Total Impact</h3>
        <div style={{fontSize:'2.5rem',fontWeight:800,color:GREEN,textAlign:'center',margin:'1rem 0'}}>
          {fmt(impacts.records.reduce((s: number, e: any) => s + e.total_tco2e_retired, 0))}
        </div>
        <div style={{textAlign:'center',color:MUTED,fontSize:'0.85rem'}}>tCO2e Retired Platform-Wide</div>
      </div>
      {impacts.records.slice(0, 3).map((e: any) => (
        <div className="card" key={e.entity_id}>
          <h3>{e.entity_name}</h3>
          <div className="stat-val">{fmt(e.total_tco2e_retired)}</div>
          <div className="stat-label">tCO2e retired &middot; {e.total_credits_retired} credits</div>
          <div style={{marginTop:'0.5rem'}}>
            <div className="stat-row"><span className="stat-label">This Year</span><span>{fmt(e.total_tco2e_this_year)}</span></div>
            <div className="stat-row"><span className="stat-label">This Month</span><span>{fmt(e.total_tco2e_this_month)}</span></div>
          </div>
        </div>
      ))}
      <div className="card">
        <h3>Leaderboard</h3>
        {lb?.entries?.map((e: any) => (
          <div className="leaderboard-row" key={e.rank}>
            <div className={`rank ${e.rank <= 3 ? 'rank-' + e.rank : ''}`}>{e.rank}</div>
            <div className="lb-name">{e.entity_name}</div>
            <div className="lb-val">{fmt(e.total_tco2e)}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Certificates</h3>
        {(certificates as any).certificates?.map((c: any) => (
          <div key={c.certificate_id} style={{marginBottom:'1rem',padding:'1rem',border:`1px solid ${GREEN_DIM}`,borderRadius:'8px'}}>
            <div style={{fontWeight:600,marginBottom:'0.25rem'}}>{c.certificate_id}</div>
            <div style={{fontSize:'0.85rem',color:MUTED}}>{c.project_name} &middot; {c.methodology_id}</div>
            <div style={{fontSize:'0.85rem'}}>{fmt(c.total_tco2e, 3)} tCO2e &middot; {c.retired_by_name}</div>
            <div style={{fontSize:'0.75rem',color:GREEN,marginTop:'0.25rem'}}>{c.reason}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Audit() {
  return (
    <div className="grid">
      <div className="card wide">
        <h3>Audit Trail</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Subject</th><th>Details</th></tr></thead>
            <tbody>
              {auditEvents.records.map((e: any) => (
                <tr key={e.event_id}>
                  <td style={{whiteSpace:'nowrap'}}>{ts(e.timestamp)}</td>
                  <td><span className={`badge ${statusBadge(e.action.includes('Retired') ? 'Retired' : e.action.includes('Issued') ? 'Issued' : e.action.includes('Sold') ? 'Sold' : 'Active')}`}>{e.action}</span></td>
                  <td>{e.actor}</td>
                  <td style={{fontFamily:'monospace',fontSize:'0.75rem'}}>{e.subject}</td>
                  <td style={{maxWidth:'300px',overflow:'hidden',textOverflow:'ellipsis',fontSize:'0.8rem',color:MUTED}}>{e.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Governance() {
  return (
    <div className="grid">
      {governance.records.map((p: any) => (
        <div className="card" key={p.proposal_id}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.5rem'}}>
            <span className={`badge ${statusBadge(p.status)}`}>{p.status}</span>
            <span style={{fontSize:'0.7rem',color:MUTED}}>{p.proposal_type.replace(/_/g, ' ')}</span>
          </div>
          <div style={{fontWeight:600,marginBottom:'0.5rem'}}>{p.title}</div>
          <div style={{fontSize:'0.8rem',color:MUTED,marginBottom:'0.75rem'}}>{p.description}</div>
          <div style={{display:'flex',gap:'1rem'}}>
            <div><span style={{color:GREEN,fontWeight:700}}>{p.votes_for}</span> <span style={{fontSize:'0.75rem',color:MUTED}}>for</span></div>
            <div><span style={{color:'#ef4444',fontWeight:700}}>{p.votes_against}</span> <span style={{fontSize:'0.75rem',color:MUTED}}>against</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AI() {
  return (
    <div className="grid">
      <div className="card wide">
        <h3>Yield Forecasts</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tenant</th><th>Project</th><th>Horizon</th><th>Estimate</th><th>80% CI Low</th><th>80% CI High</th><th>Model</th></tr></thead>
            <tbody>
              {forecasts.records.map((f: any, i: number) => (
                <tr key={i}>
                  <td>{f.tenant_id}</td>
                  <td>{f.project_id}</td>
                  <td>{f.horizon}</td>
                  <td style={{color:GREEN,fontWeight:600}}>{fmt(f.point_estimate)}</td>
                  <td>{fmt(f.confidence_lower)}</td>
                  <td>{fmt(f.confidence_upper)}</td>
                  <td>{f.model_version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h3>Risk Monitor</h3>
        {(riskData as any).risk_overlay?.map((r: any) => (
          <div key={r.contract_id} style={{marginBottom:'1rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.25rem'}}>
              <span style={{fontFamily:'monospace',fontSize:'0.8rem'}}>{r.contract_id}</span>
              <span className={`badge ${r.risk_score < 30 ? 'badge-green' : r.risk_score < 70 ? 'badge-yellow' : 'badge-red'}`}>Risk: {r.risk_score}</span>
            </div>
            <div className="bar"><div className="bar-fill" style={{width:`${r.delivery_ratio * 100}%`, background: r.risk_score < 30 ? GREEN : r.risk_score < 70 ? '#eab308' : '#ef4444'}}/></div>
            <div style={{fontSize:'0.7rem',color:MUTED}}>Delivery: {(r.delivery_ratio * 100).toFixed(0)}% &middot; Health: {r.site_health_score} &middot; Collateral: {r.collateral_coverage_pct}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Contracts() {
  return (
    <div className="grid">
      {contracts.records.map((c: any) => (
        <div className="card" key={c.contract_id}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.5rem'}}>
            <span className={`badge ${statusBadge(c.status)}`}>{c.status}</span>
            <span style={{fontSize:'0.7rem',color:MUTED}}>{c.source_type}</span>
          </div>
          <div style={{fontWeight:600,marginBottom:'0.25rem'}}>{c.contract_id}</div>
          <div style={{fontSize:'0.85rem',color:MUTED,marginBottom:'0.75rem'}}>{c.buyer} &harr; {c.seller}</div>
          <div className="stat-row"><span className="stat-label">Total</span><span>{fmt(c.total_tonnes)} tCO2e</span></div>
          <div className="stat-row"><span className="stat-label">Delivered</span><span>{fmt(c.delivered_tonnes)} tCO2e</span></div>
          <div className="stat-row"><span className="stat-label">Price</span><span>${fmt(c.price_per_tonne_usd, 2)}/t</span></div>
          <div className="bar"><div className="bar-fill" style={{width:`${c.total_tonnes > 0 ? (c.delivered_tonnes/c.total_tonnes)*100 : 0}%`}}/></div>
        </div>
      ))}
    </div>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'registry', label: 'Credit Registry' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'impact', label: 'Impact' },
  { id: 'contracts', label: 'Forward Contracts' },
  { id: 'ai', label: 'AI & Risk' },
  { id: 'audit', label: 'Audit Trail' },
  { id: 'governance', label: 'Governance' },
];

function Console() {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="console">
      <style>{css}</style>
      <div className="header">
        <svg width="28" height="28" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="#16a34a"/><path d="M16 24l5 5 11-11" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
        <h1>SynergyCarbon Console</h1>
        <span className="demo-badge">DEMO MODE</span>
        <div className="status"><div className="dot" /> Streaming Fixtures</div>
      </div>
      <div className="tabs">
        {TABS.map(t => (
          <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</div>
        ))}
      </div>
      <div className="main">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'registry' && <Registry />}
        {tab === 'marketplace' && <Marketplace />}
        {tab === 'impact' && <Impact />}
        {tab === 'contracts' && <Contracts />}
        {tab === 'ai' && <AI />}
        {tab === 'audit' && <Audit />}
        {tab === 'governance' && <Governance />}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Console />);
