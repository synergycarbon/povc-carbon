/**
 * RLHF Operator Feedback Integration
 *
 * Integrates operator corrections into the training pipeline via
 * Reinforcement Learning from Human Feedback. Operator corrections
 * are weighted by experience tier to control influence.
 *
 * Feedback types:
 *   - Yield correction: operator overrides a forecast value
 *   - Risk override: operator adjusts a risk score
 *   - Price adjustment: operator provides market intelligence
 */

// ---------------------------------------------------------------------------
// Operator Tiers
// ---------------------------------------------------------------------------

export const OPERATOR_TIER = {
  JUNIOR: 0,
  STANDARD: 1,
  SENIOR: 2,
  EXPERT: 3,
} as const;

export type OperatorTier = (typeof OPERATOR_TIER)[keyof typeof OPERATOR_TIER];

const TIER_WEIGHTS: Record<OperatorTier, number> = {
  [OPERATOR_TIER.JUNIOR]: 0.5,
  [OPERATOR_TIER.STANDARD]: 1.0,
  [OPERATOR_TIER.SENIOR]: 1.5,
  [OPERATOR_TIER.EXPERT]: 2.0,
};

// ---------------------------------------------------------------------------
// Feedback Types
// ---------------------------------------------------------------------------

export interface OperatorFeedback {
  feedback_id: string;
  operator_id: string;
  operator_tier: OperatorTier;
  feedback_type: 'yield_correction' | 'risk_override' | 'price_adjustment';
  target_id: string;
  original_value: number;
  corrected_value: number;
  reason: string;
  timestamp: number;
}

export interface FeedbackBatch {
  batch_id: string;
  feedbacks: OperatorFeedback[];
  aggregated_at: number;
}

export interface FeedbackEffect {
  feedback_id: string;
  weight: number;
  reward_signal: number;
  applied: boolean;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface RLHFConfig {
  max_operator_weight: number;
  batch_size: number;
  discount_factor: number;
  reward_clamp: number;
  staleness_decay_hours: number;
}

export const DEFAULT_RLHF_CONFIG: RLHFConfig = {
  max_operator_weight: 2.0,
  batch_size: 50,
  discount_factor: 0.95,
  reward_clamp: 3.0,
  staleness_decay_hours: 168,
};

// ---------------------------------------------------------------------------
// RLHF Manager
// ---------------------------------------------------------------------------

export class RLHFManager {
  private config: RLHFConfig;
  private feedback_buffer: OperatorFeedback[] = [];
  private applied_effects: FeedbackEffect[] = [];
  private feedback_count = 0;

  constructor(config: Partial<RLHFConfig> = {}) {
    this.config = { ...DEFAULT_RLHF_CONFIG, ...config };
  }

  submit(feedback: OperatorFeedback): FeedbackEffect {
    this.feedback_buffer.push(feedback);
    this.feedback_count++;

    const weight = Math.min(
      TIER_WEIGHTS[feedback.operator_tier],
      this.config.max_operator_weight,
    );

    const raw_reward = compute_reward_signal(
      feedback.original_value,
      feedback.corrected_value,
    );

    const clamped_reward = Math.max(
      -this.config.reward_clamp,
      Math.min(this.config.reward_clamp, raw_reward),
    );

    const effect: FeedbackEffect = {
      feedback_id: feedback.feedback_id,
      weight,
      reward_signal: clamped_reward * weight,
      applied: false,
    };

    this.applied_effects.push(effect);
    return effect;
  }

  harvest_batch(timestamp: number): FeedbackBatch | null {
    if (this.feedback_buffer.length < this.config.batch_size) return null;

    const batch_feedbacks = this.feedback_buffer.splice(0, this.config.batch_size);

    const fresh = batch_feedbacks.filter(fb => {
      const age_hours = (timestamp - fb.timestamp) / 3_600;
      return age_hours < this.config.staleness_decay_hours;
    });

    if (fresh.length === 0) return null;

    return {
      batch_id: `rlhf-batch-${Date.now()}-${this.feedback_count}`,
      feedbacks: fresh,
      aggregated_at: timestamp,
    };
  }

  compute_aggregate_reward(batch: FeedbackBatch): number {
    let total_reward = 0;
    let total_weight = 0;

    for (let i = 0; i < batch.feedbacks.length; i++) {
      const fb = batch.feedbacks[i];
      const weight = Math.min(
        TIER_WEIGHTS[fb.operator_tier],
        this.config.max_operator_weight,
      );
      const discount = Math.pow(this.config.discount_factor, i);
      const raw = compute_reward_signal(fb.original_value, fb.corrected_value);
      const clamped = Math.max(-this.config.reward_clamp, Math.min(this.config.reward_clamp, raw));

      total_reward += clamped * weight * discount;
      total_weight += weight * discount;
    }

    return total_weight > 0 ? total_reward / total_weight : 0;
  }

  get_stats(): {
    buffer_size: number;
    total_submitted: number;
    effects_count: number;
  } {
    return {
      buffer_size: this.feedback_buffer.length,
      total_submitted: this.feedback_count,
      effects_count: this.applied_effects.length,
    };
  }

  clear_buffer(): void {
    this.feedback_buffer = [];
  }
}

// ---------------------------------------------------------------------------
// Reward Signal Computation
// ---------------------------------------------------------------------------

/**
 * Compute normalized reward signal from operator correction.
 * Positive reward when correction aligns with a more accurate prediction.
 */
function compute_reward_signal(original: number, corrected: number): number {
  if (original === 0) return corrected > 0 ? 1 : 0;

  const relative_change = (corrected - original) / Math.abs(original);
  return Math.tanh(relative_change);
}
