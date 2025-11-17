/**
 * 支付相关的前端工具函数
 */

import type { CreatePaymentOrderRequest } from '@/lib/payment/types';

/**
 * 创建支付订单
 */
export async function createPaymentOrder(
  request: CreatePaymentOrderRequest
): Promise<{ success: boolean; payment_url?: string; order_id?: string; error?: string }> {
  try {
    const response = await fetch('/api/payment/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'Failed to create payment order',
      };
    }

    return {
      success: true,
      payment_url: result.data.payment_url,
      order_id: result.data.order_id,
    };
  } catch (error) {
    console.error('Error creating payment order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payment order',
    };
  }
}

/**
 * 订阅计划
 */
export async function subscribeToPlan(
  planName: 'basic' | 'pro' | 'studio'
): Promise<{ success: boolean; payment_url?: string; error?: string }> {
  const result = await createPaymentOrder({
    order_type: 'subscription',
    plan_name: planName,
  });

  if (result.success && result.payment_url) {
    // 跳转到支付页面
    window.location.href = result.payment_url;
  }

  return result;
}

/**
 * 购买积分包
 */
export async function purchaseCredits(
  packageName: string
): Promise<{ success: boolean; payment_url?: string; error?: string }> {
  const result = await createPaymentOrder({
    order_type: 'credits',
    credit_package_name: packageName,
  });

  if (result.success && result.payment_url) {
    // 跳转到支付页面
    window.location.href = result.payment_url;
  }

  return result;
}

/**
 * 刷新积分余额
 * 触发一个自定义事件，让header组件更新积分显示
 */
export function refreshCreditsBalance() {
  // 触发自定义事件
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('credits-updated'));
  }
}

