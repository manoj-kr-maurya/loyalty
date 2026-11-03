// ---- Specification Pattern: Filter Interfaces ----

export interface FilterContext {
  product?: string;
  category?: string;
  brand?: string;
  merchant?: string;
  bin?: string;          // Bank Identification Number
  channel?: string;      // e.g., WEB, MOBILE, POS, KIOSK
  location?: string;     // e.g., city, region, store
  customerTier?: string;
  paymentMethod?: string;
  [key: string]: any;
}

export interface RuleCondition {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'notIn' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'regex';
  value: any;
}

export interface RuleDefinition {
  id: string;
  name: string;
  conditions: RuleConditionGroup;
  rewardType: string;
  rewardMode: RewardMode;
  value: number;
  ratioBase?: number;
  threshold?: number;
  meta?: Record<string, any>;
  priority: number;
}

export interface RuleConditionGroup {
  operator: 'AND' | 'OR';
  conditions: (RuleConditionGroup | RuleCondition)[];
}

export interface RuleCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'notIn' | 'regex';
  value: any;
}

export type RewardMode =
  | 'RATIO'
  | 'ABSOLUTE'
  | 'PERCENTAGE'
  | 'MULTIPLIER'
  | 'SLAB'
  | 'MILESTONE';

export interface RuleEvaluationResult {
  rulesMatched: RuleMatch[];
  awards: Award[];
  totalAward: number;
}

export interface RuleMatch {
  ruleId: string;
  ruleName: string;
  rewardType: string;
  rewardMode: RewardMode;
  value: number;
  matchedConditions: string[];
}

export interface Award {
  ruleId: string;
  ruleName: string;
  rewardType: string;
  rewardMode: RewardMode;
  amount: number;
  currency?: string;
  meta?: Record<string, any>;
}

export interface SlabDefinition {
  min: number;
  max?: number;
  value: number;
  rewardMode: RewardMode;
}

export interface MilestoneDefinition {
  threshold: number;
  value: number;
  rewardMode: RewardMode;
  repeatable?: boolean;
}