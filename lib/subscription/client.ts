/**
 * 客户端订阅计划工具函数
 */

import { SubscriptionPlan } from './rules';

/**
 * 获取用户订阅计划
 */
export async function getUserSubscriptionPlan(): Promise<{
  plan: SubscriptionPlan;
  expiresAt: string | null;
  error?: string;
}> {
  try {
    const response = await fetch('/api/subscription/plan');
    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        plan: null,
        expiresAt: null,
        error: result.error || 'Failed to fetch subscription plan',
      };
    }

    return {
      plan: result.data.plan,
      expiresAt: result.data.expiresAt,
    };
  } catch (error) {
    return {
      plan: null,
      expiresAt: null,
      error: error instanceof Error ? error.message : 'Failed to fetch subscription plan',
    };
  }
}

