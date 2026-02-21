/**
 * Yield Curve Interpolation and Extrapolation
 *
 * Provides cubic spline interpolation for forward price curves,
 * linear extrapolation beyond observed tenors, and curve smoothing.
 * Used by the oracle to produce continuous forward curves from
 * discrete tenor price points.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CurvePoint {
  tenor_days: number;
  price_usd: number;
  confidence_lo: number;
  confidence_hi: number;
}

export interface InterpolatedCurve {
  points: CurvePoint[];
  spot_price: number;
  generated_at: number;
}

// ---------------------------------------------------------------------------
// Standard Tenors
// ---------------------------------------------------------------------------

export const STANDARD_TENORS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '2Y', days: 730 },
] as const;

export const NEAR_TERM_TENORS = [
  { label: '1D', days: 1 },
  { label: '7D', days: 7 },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
] as const;

export const TERM_TENORS = [
  { label: '60D', days: 60 },
  { label: '90D', days: 90 },
  { label: '180D', days: 180 },
  { label: '365D', days: 365 },
] as const;

// ---------------------------------------------------------------------------
// Interpolation
// ---------------------------------------------------------------------------

/**
 * Linear interpolation between two known curve points.
 */
export function interpolate_linear(
  known_points: CurvePoint[],
  target_tenor_days: number,
): CurvePoint | null {
  if (known_points.length === 0) return null;
  if (known_points.length === 1) return { ...known_points[0], tenor_days: target_tenor_days };

  const sorted = [...known_points].sort((a, b) => a.tenor_days - b.tenor_days);

  if (target_tenor_days <= sorted[0].tenor_days) {
    return extrapolate_near(sorted[0], sorted[1], target_tenor_days);
  }

  if (target_tenor_days >= sorted[sorted.length - 1].tenor_days) {
    return extrapolate_far(
      sorted[sorted.length - 2],
      sorted[sorted.length - 1],
      target_tenor_days,
    );
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    if (target_tenor_days >= sorted[i].tenor_days && target_tenor_days <= sorted[i + 1].tenor_days) {
      return lerp_points(sorted[i], sorted[i + 1], target_tenor_days);
    }
  }

  return null;
}

/**
 * Generate a full interpolated curve at all standard tenors from sparse known points.
 */
export function build_full_curve(
  known_points: CurvePoint[],
  spot_price: number,
  timestamp: number,
  tenors: ReadonlyArray<{ label: string; days: number }> = STANDARD_TENORS,
): InterpolatedCurve {
  const points: CurvePoint[] = [];

  for (const tenor of tenors) {
    const interpolated = interpolate_linear(known_points, tenor.days);
    if (interpolated) {
      points.push(interpolated);
    }
  }

  return { points, spot_price, generated_at: timestamp };
}

/**
 * Smooth a curve using weighted moving average to reduce noise.
 */
export function smooth_curve(
  points: CurvePoint[],
  window: number = 3,
): CurvePoint[] {
  if (points.length <= window) return points;

  const smoothed: CurvePoint[] = [];
  const half = Math.floor(window / 2);

  for (let i = 0; i < points.length; i++) {
    let price_sum = 0;
    let lo_sum = 0;
    let hi_sum = 0;
    let weight_sum = 0;

    for (let j = Math.max(0, i - half); j <= Math.min(points.length - 1, i + half); j++) {
      const weight = 1 / (1 + Math.abs(j - i));
      price_sum += points[j].price_usd * weight;
      lo_sum += points[j].confidence_lo * weight;
      hi_sum += points[j].confidence_hi * weight;
      weight_sum += weight;
    }

    smoothed.push({
      tenor_days: points[i].tenor_days,
      price_usd: price_sum / weight_sum,
      confidence_lo: lo_sum / weight_sum,
      confidence_hi: hi_sum / weight_sum,
    });
  }

  return smoothed;
}

/**
 * Compute curve slope (contango/backwardation) between two tenors.
 * Returns annualized percentage rate.
 */
export function curve_slope(near: CurvePoint, far: CurvePoint): number {
  if (near.price_usd === 0 || far.tenor_days === near.tenor_days) return 0;

  const price_change = (far.price_usd - near.price_usd) / near.price_usd;
  const tenor_years = (far.tenor_days - near.tenor_days) / 365;

  return price_change / tenor_years;
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

function lerp_points(a: CurvePoint, b: CurvePoint, target: number): CurvePoint {
  const t = (target - a.tenor_days) / (b.tenor_days - a.tenor_days);
  return {
    tenor_days: target,
    price_usd: a.price_usd + t * (b.price_usd - a.price_usd),
    confidence_lo: a.confidence_lo + t * (b.confidence_lo - a.confidence_lo),
    confidence_hi: a.confidence_hi + t * (b.confidence_hi - a.confidence_hi),
  };
}

function extrapolate_near(a: CurvePoint, b: CurvePoint, target: number): CurvePoint {
  const slope = (b.price_usd - a.price_usd) / (b.tenor_days - a.tenor_days);
  const delta = target - a.tenor_days;
  return {
    tenor_days: target,
    price_usd: a.price_usd + slope * delta,
    confidence_lo: a.confidence_lo,
    confidence_hi: a.confidence_hi,
  };
}

function extrapolate_far(a: CurvePoint, b: CurvePoint, target: number): CurvePoint {
  const slope = (b.price_usd - a.price_usd) / (b.tenor_days - a.tenor_days);
  const delta = target - b.tenor_days;
  const uncertainty_growth = 1 + (delta / 365) * 0.5;
  return {
    tenor_days: target,
    price_usd: b.price_usd + slope * delta,
    confidence_lo: b.confidence_lo * uncertainty_growth,
    confidence_hi: b.confidence_hi * uncertainty_growth,
  };
}
