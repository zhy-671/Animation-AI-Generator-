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
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || `HTTP ${response.status}` };
      }
      return {
        success: false,
        error: errorData.error || `Failed to create payment order (${response.status})`,
      };
    }

    const result = await response.json();
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to create payment order',
      };
    }

    if (!result.data || !result.data.payment_url) {
      return {
        success: false,
        error: 'Payment URL not received from server',
      };
    }

    return {
      success: true,
      payment_url: result.data.payment_url,
      order_id: result.data.order_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payment order',
    };
  }
}

/**
 * 订阅计划
 * 使用 /api/payment/create-subscription 端点
 */
export async function subscribeToPlan(
  planName: 'basic' | 'pro' | 'studio'
): Promise<{ success: boolean; payment_url?: string; error?: string }> {
  try {
    // 直接调用 API，让服务器端处理 product_id 的获取和验证
    // 客户端无法访问服务器端环境变量，所以不在客户端检查
    const response = await fetch('/api/payment/create-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planName: planName, // 传递计划名称，让服务器端查找对应的 product_id
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || `HTTP ${response.status}` };
      }
      return {
        success: false,
        error: errorData.error || `Failed to create subscription checkout (${response.status})`,
      };
    }

    const result = await response.json();
    if (!result.checkoutUrl) {
      return {
        success: false,
        error: 'Checkout URL not received from server',
      };
    }

    // 跳转到支付页面
    window.location.href = result.checkoutUrl;

    return {
      success: true,
      payment_url: result.checkoutUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to subscribe to plan',
    };
  }
}

/**
 * 购买积分包
 * 使用 /api/payment/create-checkout 端点
 */
export async function purchaseCredits(
  packageName: string
): Promise<{ success: boolean; payment_url?: string; error?: string }> {
  try {
    // 直接调用 API，让服务器端处理 product_id 的获取和验证
    // 客户端无法访问服务器端环境变量，所以不在客户端检查
    const response = await fetch('/api/payment/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        packageName: packageName, // 传递包名称，让服务器端查找对应的 product_id
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || `HTTP ${response.status}` };
      }
      return {
        success: false,
        error: errorData.error || `Failed to create checkout (${response.status})`,
      };
    }

    const result = await response.json();
    if (!result.checkoutUrl) {
      return {
        success: false,
        error: 'Checkout URL not received from server',
      };
    }

    // 跳转到支付页面
    window.location.href = result.checkoutUrl;

    return {
      success: true,
      payment_url: result.checkoutUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to purchase credits',
    };
  }
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

