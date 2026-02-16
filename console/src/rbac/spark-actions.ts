/**
 * Spark Action Gate Definitions
 *
 * Spark actions are authenticated operations that require ML-DSA-87
 * signatures via the Spark wire protocol. Each action defines:
 * - Required role
 * - Confirmation UI type (visual challenge, simple confirm, etc.)
 * - Circuit target (which SmartCircuit processes the action)
 * - Lex topic for the action request
 */

export interface SparkActionDefinition {
  id: string;
  name: string;
  description: string;
  required_role: string;
  confirmation: 'spark_visual_challenge' | 'simple_confirm' | 'double_confirm';
  circuit_target: string;
  lex_topic: string;
  audit_action: string;
}

export const SPARK_ACTIONS: Record<string, SparkActionDefinition> = {
  retire_credits: {
    id: 'retire_credits',
    name: 'Retire Credits',
    description: 'Permanently retire carbon credits with beneficiary attribution',
    required_role: 'owner',
    confirmation: 'spark_visual_challenge',
    circuit_target: 'sc.core.retirement_engine.v1',
    lex_topic: 'lex://sc/credits/retire',
    audit_action: 'CreditRetired',
  },

  governance_vote: {
    id: 'governance_vote',
    name: 'Governance Vote',
    description: 'Cast a vote on an active governance proposal',
    required_role: 'owner',
    confirmation: 'spark_visual_challenge',
    circuit_target: 'sc.governance.v1',
    lex_topic: 'lex://sc/governance/proposals/vote',
    audit_action: 'VoteCast',
  },

  sign_contract: {
    id: 'sign_contract',
    name: 'Sign Forward Contract',
    description: 'Accept and sign a forward carbon credit contract',
    required_role: 'owner',
    confirmation: 'spark_visual_challenge',
    circuit_target: 'sc.marketplace.forward_contracts.v1',
    lex_topic: 'lex://sc/contracts/accept',
    audit_action: 'ContractAccepted',
  },

  cancel_listing: {
    id: 'cancel_listing',
    name: 'Cancel Listing',
    description: 'Remove a credit listing from the marketplace',
    required_role: 'owner',
    confirmation: 'simple_confirm',
    circuit_target: 'sc.marketplace.orderbook.v1',
    lex_topic: 'lex://sc/marketplace/cancel',
    audit_action: 'CreditCancelled',
  },

  propose_methodology: {
    id: 'propose_methodology',
    name: 'Propose Methodology',
    description: 'Submit a new carbon calculation methodology for governance approval',
    required_role: 'owner',
    confirmation: 'double_confirm',
    circuit_target: 'sc.governance.v1',
    lex_topic: 'lex://sc/governance/methodology/propose',
    audit_action: 'MethodologyApproved',
  },

  register_verifier: {
    id: 'register_verifier',
    name: 'Register Verifier',
    description: 'Register a new witness verifier key for attestation',
    required_role: 'owner',
    confirmation: 'double_confirm',
    circuit_target: 'sc.governance.v1',
    lex_topic: 'lex://sc/governance/verifier/register',
    audit_action: 'VerifierRegistered',
  },

  place_order: {
    id: 'place_order',
    name: 'Place Order',
    description: 'Place a buy order for carbon credits on the marketplace',
    required_role: 'buyer',
    confirmation: 'simple_confirm',
    circuit_target: 'sc.marketplace.orderbook.v1',
    lex_topic: 'lex://sc/marketplace/order',
    audit_action: 'OrderPlaced',
  },

  create_trigger: {
    id: 'create_trigger',
    name: 'Create Retirement Trigger',
    description: 'Set up an automated retirement trigger (schedule, threshold, or stream)',
    required_role: 'owner',
    confirmation: 'simple_confirm',
    circuit_target: 'sc.core.retirement_engine.v1',
    lex_topic: 'lex://sc/retirements/trigger/create',
    audit_action: 'TriggerCreated',
  },
} as const;
