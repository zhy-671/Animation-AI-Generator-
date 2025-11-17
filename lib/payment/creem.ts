/**
 * Cream支付API客户端
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
    // TODO: 根据Cream API文档实现实际的API调用
    // 这里是一个示例实现，需要根据实际的Cream API文档进行调整
    
    const requestBody: Record<string, any> = {
      order_id: orderId,
      amount: amount,
      currency: 'USD',
      description: description,
      return_url: CREEM_CONFIG.returnUrl,
      cancel_url: CREEM_CONFIG.cancelUrl,
      metadata: {
        ...metadata,
        order_id: orderId,
      },
    };

    // 如果是订阅订单或积分购买订单，添加产品ID
    if (metadata?.order_type === 'subscription' || metadata?.order_type === 'credits') {
      // Cream需要product_id
      if (metadata?.product_id) {
        requestBody.product_id = metadata.product_id;
      }
    }
    
    const response = await fetch(`${CREEM_CONFIG.baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CREEM_CONFIG.apiKey}`,
        'X-API-Secret': CREEM_CONFIG.apiSecret,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    
    return {
      success: true,
      payment_url: data.payment_url,
      creem_order_id: data.order_id,
    };
  } catch (error) {
    console.error('Error creating Cream order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payment order',
    };
  }
}

/**
 * 验证Cream Webhook签名
 */
export function verifyCreemWebhookSignature(
  payload: string,
  signature: string
): boolean {
  // 🔒 安全措施：必须实现签名验证
  if (!CREEM_CONFIG.webhookSecret) {
    console.error('CREEM_WEBHOOK_SECRET is not set! Webhook signature verification is disabled.');
    // 生产环境必须设置webhook secret
    if (process.env.NODE_ENV === 'production') {
      return false; // 生产环境必须验证签名
    }
    return true; // 开发环境可以跳过验证
  }

  if (!signature) {
    console.error('Missing webhook signature');
    return false;
  }

  // TODO: 根据Cream API文档实现签名验证
  // 示例：使用HMAC-SHA256验证签名
  // const crypto = require('crypto');
  // const expectedSignature = crypto
  //   .createHmac('sha256', CREEM_CONFIG.webhookSecret)
  //   .update(payload)
  //   .digest('hex');
  // 
  // // 使用时间安全的比较函数防止时序攻击
  // return crypto.timingSafeEqual(
  //   Buffer.from(signature),
  //   Buffer.from(expectedSignature)
  // );

  // ⚠️ 临时实现：需要根据实际Cream API文档实现
  // 在生产环境使用前，必须实现正确的签名验证逻辑
  console.warn('Webhook signature verification not fully implemented. Please implement according to Cream API docs.');
  
  // 临时：简单验证签名格式
  if (signature.length < 32) {
    return false;
  }

  return true; // 临时返回true，需要根据实际API实现
}

/**
 * 查询Cream订单状态
 */
export async function getCreemOrderStatus(
  creemOrderId: string
): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    const response = await fetch(`${CREEM_CONFIG.baseUrl}/api/v1/orders/${creemOrderId}`, {
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
    console.error('Error getting Cream order status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get order status',
    };
  }
}

