import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface PricingTier {
  id: string;
  minAum: number;
  maxAum: number | null; // null means infinity
  bpsRate: number; // Basis points
  label: string;
}

export interface PerformanceFeeConfig {
  enabled: boolean;
  ratePct: number; 
  benchmark: string;
  hurdleRatePct: number; 
  highWaterMark: boolean;
}

export interface FixedFeeConfig {
  enabled: boolean;
  annualAmount: number;
}

// Previously TenantPricingConfig. Now a discrete Plan assigned a name.
export interface PricingPlan {
  id: string;
  name: string;
  isDefault: boolean;
  aumTiers: PricingTier[];
  performanceFee: PerformanceFeeConfig;
  fixedFee: FixedFeeConfig;
}

// Wrapper for the single DB doc storing all tenant plans
export interface TenantPricingSettings {
  plans: PricingPlan[];
}

export const DEFAULT_AUM_PRICING_CONFIG: PricingTier[] = [
  { id: 'tier_1', minAum: 0, maxAum: 10_000_000, bpsRate: 50, label: '< $10M (50 bps)' },
  { id: 'tier_2', minAum: 10_000_000, maxAum: 25_000_000, bpsRate: 35, label: '$10M - $25M (35 bps)' },
  { id: 'tier_3', minAum: 25_000_000, maxAum: 50_000_000, bpsRate: 25, label: '$25M - $50M (25 bps)' },
  { id: 'tier_4', minAum: 50_000_000, maxAum: 100_000_000, bpsRate: 20, label: '$50M - $100M (20 bps)' },
  { id: 'tier_5', minAum: 100_000_000, maxAum: null, bpsRate: 15, label: '> $100M (15 bps)' },
];

export const DEFAULT_PERFORMANCE_FEE: PerformanceFeeConfig = {
  enabled: false,
  ratePct: 20,
  benchmark: 'IPCA + 5%',
  hurdleRatePct: 5,
  highWaterMark: true,
};

export const DEFAULT_FIXED_FEE: FixedFeeConfig = {
  enabled: false,
  annualAmount: 60000,
};

export const DEFAULT_PRICING_PLAN: PricingPlan = {
  id: 'default_plan_1',
  name: 'Standard Base Fee (Default)',
  isDefault: true,
  aumTiers: DEFAULT_AUM_PRICING_CONFIG,
  performanceFee: DEFAULT_PERFORMANCE_FEE,
  fixedFee: DEFAULT_FIXED_FEE,
};

export const DEFAULT_TENANT_SETTINGS: TenantPricingSettings = {
  plans: [DEFAULT_PRICING_PLAN],
};

/**
 * Calculates Expected Annual Revenue given an AUM & a specific pricing plan.
 * Performance Fees are excluded from expected baseline since they're speculative.
 */
export function calculateExpectedRevenue(aum: number, plan: PricingPlan = DEFAULT_PRICING_PLAN): number {
  if (!aum || aum <= 0) {
    return plan.fixedFee?.enabled ? plan.fixedFee.annualAmount : 0;
  }
  
  const sortedConfig = [...(plan.aumTiers || [])].sort((a, b) => a.minAum - b.minAum);
  
  let appliedBps = 0;
  for (const tier of sortedConfig) {
    if (aum >= tier.minAum && (tier.maxAum === null || aum < tier.maxAum)) {
      appliedBps = tier.bpsRate;
      break;
    }
  }

  const aumFee = aum * (appliedBps / 10000);
  const fixedFee = plan.fixedFee?.enabled ? plan.fixedFee.annualAmount : 0;
  
  return aumFee + fixedFee;
}

// ─── Firebase Fetchers ───

export async function getTenantPricingPlans(tenantId: string): Promise<TenantPricingSettings> {
  if (!tenantId) return DEFAULT_TENANT_SETTINGS;
  try {
    const snap = await getDoc(doc(db, 'tenants', tenantId, 'settings', 'pricing'));
    if (snap.exists()) {
      const data = snap.data();
      // Migration path for older tenants who had single configs directly inside `pricing` doc
      if (!data.plans) {
        return {
           plans: [{
             id: 'migrated_legacy_plan',
             name: 'Legacy Global Pricing',
             isDefault: true,
             aumTiers: data.aumTiers || data.tiers || DEFAULT_AUM_PRICING_CONFIG,
             performanceFee: data.performanceFee || DEFAULT_PERFORMANCE_FEE,
             fixedFee: data.fixedFee || DEFAULT_FIXED_FEE
           }]
        };
      }
      return data as TenantPricingSettings;
    }
    return DEFAULT_TENANT_SETTINGS;
  } catch (err) {
    console.warn('Failed fetching pricing configs', err);
    return DEFAULT_TENANT_SETTINGS;
  }
}

export async function saveTenantPricingPlans(tenantId: string, settings: TenantPricingSettings): Promise<void> {
  if (!tenantId) throw new Error("No tenant ID");
  await setDoc(doc(db, 'tenants', tenantId, 'settings', 'pricing'), settings);
}
