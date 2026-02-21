/**
 * Feature Vector Extraction
 *
 * Extracts an 20-feature observation vector from telemetry, market data,
 * weather, and calendar sources. Each feature is normalized for SSM ingestion.
 *
 * Feature layout (20 features per observation window):
 *   Power   (4): power_mean, trend_slope, r_squared, capacity_factor
 *   Carbon  (4): minting_rate, gas_flow, ch4_mass, attestation_success_rate
 *   Market  (3): spot_price, volume_24h, forward_committed_pct
 *   Weather (4): ambient_temp, wind_speed, irradiance, precipitation
 *   Calendar(5): hour_sin, hour_cos, day_sin, day_cos, is_weekend
 */

export const FEATURE_COUNT = 20;

// ---------------------------------------------------------------------------
// Input Telemetry Types
// ---------------------------------------------------------------------------

export interface PowerTelemetry {
  power_mean_w: number;
  capacity_factor: number;
  trend_slope: number;
  r_squared: number;
  timestamp: number;
}

export interface CarbonTelemetry {
  minting_rate_tco2e_hour: number;
  gas_flow_mcf_hour: number;
  ch4_mass_kg: number;
  attestation_success_rate: number;
  timestamp: number;
}

export interface MarketSnapshot {
  spot_price_usd: number;
  volume_24h_tco2e: number;
  forward_committed_pct: number;
  timestamp: number;
}

export interface WeatherData {
  ambient_temp_c: number;
  wind_speed_ms: number;
  irradiance_wm2: number;
  precipitation_mm: number;
  timestamp: number;
}

export interface CalendarContext {
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Feature Extraction
// ---------------------------------------------------------------------------

export interface FeatureExtractionInput {
  power: PowerTelemetry;
  carbon: CarbonTelemetry;
  market: MarketSnapshot;
  weather: WeatherData;
  calendar: CalendarContext;
}

export function extract_features(input: FeatureExtractionInput): Float64Array {
  const features = new Float64Array(FEATURE_COUNT);

  // Power features (0–3)
  features[0] = normalize_power(input.power.power_mean_w);
  features[1] = clamp(input.power.trend_slope, -1, 1);
  features[2] = clamp(input.power.r_squared, 0, 1);
  features[3] = clamp(input.power.capacity_factor, 0, 1);

  // Carbon features (4–7)
  features[4] = normalize_minting_rate(input.carbon.minting_rate_tco2e_hour);
  features[5] = normalize_gas_flow(input.carbon.gas_flow_mcf_hour);
  features[6] = normalize_ch4_mass(input.carbon.ch4_mass_kg);
  features[7] = clamp(input.carbon.attestation_success_rate, 0, 1);

  // Market features (8–10)
  features[8] = normalize_price(input.market.spot_price_usd);
  features[9] = normalize_volume(input.market.volume_24h_tco2e);
  features[10] = clamp(input.market.forward_committed_pct, 0, 1);

  // Weather features (11–14)
  features[11] = normalize_temperature(input.weather.ambient_temp_c);
  features[12] = normalize_wind(input.weather.wind_speed_ms);
  features[13] = normalize_irradiance(input.weather.irradiance_wm2);
  features[14] = normalize_precipitation(input.weather.precipitation_mm);

  // Calendar features (15–19)
  const date = new Date(input.calendar.timestamp * 1000);
  const hour = date.getUTCHours();
  const day_of_year = get_day_of_year(date);

  features[15] = Math.sin((2 * Math.PI * hour) / 24);       // hour_sin
  features[16] = Math.cos((2 * Math.PI * hour) / 24);       // hour_cos
  features[17] = Math.sin((2 * Math.PI * day_of_year) / 365); // day_sin
  features[18] = Math.cos((2 * Math.PI * day_of_year) / 365); // day_cos
  features[19] = date.getUTCDay() === 0 || date.getUTCDay() === 6 ? 1.0 : 0.0; // is_weekend

  return features;
}

/**
 * Build a windowed feature matrix from a time series of observations.
 * Returns [window_size x FEATURE_COUNT] suitable for SSM context input.
 */
export function build_feature_window(
  observations: FeatureExtractionInput[],
  window_size: number,
): Float64Array[] {
  const start = Math.max(0, observations.length - window_size);
  const windowed = observations.slice(start);
  return windowed.map(extract_features);
}

/**
 * Compute EWMA-smoothed features for noise reduction before SSM inference.
 */
export function ewma_smooth(
  feature_history: Float64Array[],
  alpha: number,
): Float64Array {
  if (feature_history.length === 0) {
    return new Float64Array(FEATURE_COUNT);
  }

  const smoothed = new Float64Array(feature_history[0]);

  for (let t = 1; t < feature_history.length; t++) {
    for (let f = 0; f < FEATURE_COUNT; f++) {
      smoothed[f] = alpha * feature_history[t][f] + (1 - alpha) * smoothed[f];
    }
  }

  return smoothed;
}

// ---------------------------------------------------------------------------
// Normalization Helpers
// ---------------------------------------------------------------------------

function normalize_power(watts: number): number {
  return clamp(watts / 100_000, 0, 1);
}

function normalize_minting_rate(rate: number): number {
  return clamp(rate / 10, 0, 1);
}

function normalize_gas_flow(mcf_hour: number): number {
  return clamp(mcf_hour / 100, 0, 1);
}

function normalize_ch4_mass(kg: number): number {
  return clamp(kg / 1_000, 0, 1);
}

function normalize_price(usd: number): number {
  return clamp(usd / 200, 0, 1);
}

function normalize_volume(tco2e: number): number {
  return clamp(tco2e / 100_000, 0, 1);
}

function normalize_temperature(celsius: number): number {
  return clamp((celsius + 40) / 100, 0, 1);
}

function normalize_wind(ms: number): number {
  return clamp(ms / 50, 0, 1);
}

function normalize_irradiance(wm2: number): number {
  return clamp(wm2 / 1_200, 0, 1);
}

function normalize_precipitation(mm: number): number {
  return clamp(mm / 100, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function get_day_of_year(date: Date): number {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
