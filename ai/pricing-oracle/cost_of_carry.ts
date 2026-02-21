/**
 * Cost-of-Carry Model
 *
 * Computes the cost of carrying carbon credits forward in time, including
 * storage costs (lex storage fees), time value of capital (risk-free rate),
 * insurance, and convenience yield. Used by the forward pricing oracle
 * to generate forward price curves from spot prices.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface CostOfCarryConfig {
  risk_free_rate_annual: number;
  convenience_yield_annual: number;
  storage_cost_per_tonne_annual: number;
  insurance_rate_annual: number;
}

export const DEFAULT_CARRY_CONFIG: CostOfCarryConfig = {
  risk_free_rate_annual: 0.05,
  convenience_yield_annual: 0.02,
  storage_cost_per_tonne_annual: 0.25,
  insurance_rate_annual: 0.005,
};

// ---------------------------------------------------------------------------
// Cost Components
// ---------------------------------------------------------------------------

export interface CarryCostBreakdown {
  tenor_days: number;
  time_value: number;
  storage_cost: number;
  insurance_cost: number;
  convenience_yield: number;
  net_carry_cost: number;
  carry_multiplier: number;
}

// ---------------------------------------------------------------------------
// Cost-of-Carry Computation
// ---------------------------------------------------------------------------

/**
 * Compute the forward price using the cost-of-carry model:
 *   F = S * e^((r - y + s + i) * T)
 *
 * Where:
 *   S = spot price
 *   r = risk-free rate
 *   y = convenience yield
 *   s = storage cost rate
 *   i = insurance rate
 *   T = time to maturity (years)
 */
export function compute_forward_price(
  spot_price: number,
  tenor_days: number,
  config: CostOfCarryConfig = DEFAULT_CARRY_CONFIG,
): number {
  const t = tenor_days / 365;
  const net_rate = config.risk_free_rate_annual
    - config.convenience_yield_annual
    + (config.storage_cost_per_tonne_annual / spot_price)
    + config.insurance_rate_annual;

  return spot_price * Math.exp(net_rate * t);
}

/**
 * Full breakdown of carry cost components for a given tenor.
 */
export function compute_carry_breakdown(
  spot_price: number,
  tenor_days: number,
  config: CostOfCarryConfig = DEFAULT_CARRY_CONFIG,
): CarryCostBreakdown {
  const t = tenor_days / 365;

  const time_value = spot_price * (Math.exp(config.risk_free_rate_annual * t) - 1);
  const storage_cost = config.storage_cost_per_tonne_annual * t;
  const insurance_cost = spot_price * config.insurance_rate_annual * t;
  const convenience_yield = spot_price * (Math.exp(config.convenience_yield_annual * t) - 1);

  const net_carry_cost = time_value + storage_cost + insurance_cost - convenience_yield;
  const forward_price = compute_forward_price(spot_price, tenor_days, config);
  const carry_multiplier = spot_price > 0 ? forward_price / spot_price : 1;

  return {
    tenor_days,
    time_value,
    storage_cost,
    insurance_cost,
    convenience_yield,
    net_carry_cost,
    carry_multiplier,
  };
}

/**
 * Compute implied convenience yield from observed spot and forward prices.
 *   y = r + s + i - ln(F/S) / T
 */
export function implied_convenience_yield(
  spot_price: number,
  forward_price: number,
  tenor_days: number,
  config: Omit<CostOfCarryConfig, 'convenience_yield_annual'>,
): number {
  if (spot_price <= 0 || forward_price <= 0 || tenor_days <= 0) return 0;

  const t = tenor_days / 365;
  const storage_rate = config.storage_cost_per_tonne_annual / spot_price;
  const observed_rate = Math.log(forward_price / spot_price) / t;

  return config.risk_free_rate_annual + storage_rate + config.insurance_rate_annual - observed_rate;
}
