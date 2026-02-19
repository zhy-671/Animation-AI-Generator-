/**
 * Creem支付API客户端
 * 文档: https://docs.creem.io/api-reference/introduction
 */

import { CREEM_CONFIG, SUBSCRIPTION_PLANS, CREDIT_PACKAGES } from './config';
import type { CreatePaymentOrderRequest, CreamPaymentWebhook } from './types';

/**
 * 创建Cream支付订单
 * @param orderId 订单ID
 * @param amount 支付金额
 * @param description 订单描述
 * @param metadata 元数据（包含订阅ID、产品ID等）
 */
export async function createCreemOrder(
  orderId: string,
  amount: number,
  description: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; payment_url?: string; creem_order_id?: string; error?: string }> {
  try {
    // 检查API配置
    // 根据 Creem API 文档，只需要 API Key
    if (!CREEM_CONFIG.apiKey) {
      return {
        success: false,
        error: 'Payment service credentials not configured. Please set CREEM_API_KEY environment variable.',
      };
    }

    // 根据 Creem API 文档: https://docs.creem.io/checkout-flow
    // 创建结账会话需要使用 product_id
    // 端点: POST /checkouts
    if (!metadata?.product_id) {
      return {
        success: false,
        error: 'Product ID is required. Please configure product_id for the subscription plan or credit package.',
      };
    }

    // Creem API 结账请求体
    // 参考实现：只需要 product_id 和 metadata，success_url 是可选的
    const requestBody: Record<string, any> = {
      product_id: metadata.product_id,
      metadata: {
        order_id: orderId,
        user_id: metadata.customer_id || metadata.user_id,
        customer_id: metadata.customer_id,
        order_type: metadata.order_type,
        plan_name: metadata.plan_name,
        credit_package_name: metadata.credit_package_name,
        credits_amount: metadata.credits_amount,
        product_id: metadata.product_id, // Add product_id to metadata for bonus calculation
      },
    };

    // 只有当配置了 success_url 时才添加（参考实现）
    if (CREEM_CONFIG.successUrl) {
      requestBody.success_url = CREEM_CONFIG.successUrl;
    }
    
    // 构建完整的API URL
    // 端点: POST /checkouts（不是 /v1/checkouts）
    const apiUrl = CREEM_CONFIG.checkoutEndpoint.startsWith('http')
      ? CREEM_CONFIG.checkoutEndpoint
      : `${CREEM_CONFIG.apiUrl}${CREEM_CONFIG.checkoutEndpoint.startsWith('/') ? '' : '/'}${CREEM_CONFIG.checkoutEndpoint}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CREEM_CONFIG.apiKey, // 根据 Creem API 文档使用 x-api-key
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || `HTTP ${response.status}: ${response.statusText}` };
      }
      // 根据不同的错误状态码提供更友好的错误信息
      let errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      
      if (response.status === 404) {
        errorMessage = `Checkout API endpoint not found (${apiUrl}). Please verify:\n1. CREEM_API_URL or CREEM_BASE_URL is set correctly (should be https://api.creem.io)\n2. CREEM_CHECKOUT_ENDPOINT is set correctly (should be /checkouts)\n3. Product ID is valid`;
      } else if (response.status === 401) {
        errorMessage = 'API key is missing. Please verify CREEM_API_KEY is set correctly.';
      } else if (response.status === 403) {
        errorMessage = 'API key is invalid. Please verify CREEM_API_KEY is correct.';
      } else if (response.status === 400) {
        errorMessage = `Invalid request: ${errorMessage}. Please check product_id and request parameters.`;
      } else if (response.status >= 500) {
        errorMessage = 'Payment service temporarily unavailable. Please try again later.';
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    const data = await response.json();
    // Creem API 返回 checkout_url 或 url
    // 参考实现：检查 checkout_url 或 url
    const checkoutUrl = data?.checkout_url || data?.url;
    if (!checkoutUrl) {
      return {
        success: false,
        error: 'Checkout URL not received from payment provider',
      };
    }
    
    return {
      success: true,
      payment_url: checkoutUrl, // Creem 返回的是 checkout_url 或 url
      creem_order_id: data.id || data.checkout_id || orderId, // Creem 可能返回 checkout_id
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payment order',
    };
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * 验证Creem Webhook签名
 * 根据 Creem API 文档，签名使用 HMAC-SHA256
 */
export function verifyCreemWebhookSignature(
  payload: string,
  signature: string,
  secret?: string
): boolean {
  // 使用传入的 secret 或从配置中获取
  const webhookSecret = secret || CREEM_CONFIG.webhookSecret;

  // 🔒 安全措施：必须实现签名验证
  if (!webhookSecret) {
    // 生产环境必须设置webhook secret
    if (process.env.NODE_ENV === 'production') {
      return false; // 生产环境必须验证签名
    }
    // 开发/测试环境：如果没有设置 secret，暂时允许通过（但记录警告）
    return true; // 开发环境可以跳过验证
  }

  if (!signature) {
    return false;
  }

  try {
    // 使用 HMAC-SHA256 验证签名
    const { createHmac } = require('crypto');
    const hmac = createHmac('sha256', webhookSecret);
    const calculatedSignature = hmac.update(payload).digest('hex');

    // 使用时间安全的比较函数防止时序攻击
    const isValid = timingSafeEqual(signature, calculatedSignature);
    
    if (!isValid) {
    }

    return isValid;
  } catch (error) {
    return false;
  }
}

/**
 * 查询Cream订单状态
 */
export async function getCreemOrderStatus(
  creemOrderId: string
): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    const response = await fetch(`${CREEM_CONFIG.apiUrl}/api/v1/orders/${creemOrderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CREEM_CONFIG.apiKey}`,
        'X-API-Secret': CREEM_CONFIG.apiSecret,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    
    return {
      success: true,
      status: data.status, // 'pending' | 'completed' | 'failed' | 'cancelled'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get order status',
    };
  }
}

