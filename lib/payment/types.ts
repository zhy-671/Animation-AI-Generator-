/**
 * Cream支付相关类型定义
 */

export type PaymentOrderType = 'subscription' | 'credits';
export type PaymentOrderStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';

export interface PaymentOrder {
  id: string;
  customer_id: string;
  order_type: PaymentOrderType;
  plan_name: string | null; // 'basic' | 'pro' | 'studio' | null
  credit_package_name: string | null; // 'Small Pack' | 'Medium Pack' | etc.
  credits_amount: number | null; // 购买的积分数量
  amount: number; // 支付金额（美元）
  currency: string;
  creem_order_id: string | null;
  creem_payment_id: string | null;
  status: PaymentOrderStatus;
  payment_method: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  expires_at: string | null;
}

export interface CreatePaymentOrderRequest {
  order_type: PaymentOrderType;
  plan_name?: string; // 订阅计划名称
  credit_package_name?: string; // 积分包名称
  credits_amount?: number; // 购买的积分数量
}

// Creem 实际 webhook 格式
export interface CreemWebhookEvent {
  id: string;
  eventType: string; // 'checkout.completed', 'checkout.failed', etc.
  created_at: number;
  object: {
    id: string; // checkout ID
    object: 'checkout';
    order?: {
      id: string; // Creem order ID
      object: 'order';
      customer: string;
      product: string;
      amount: number;
      currency: string;
      status: 'paid' | 'pending' | 'failed' | 'cancelled';
      type?: 'recurring' | 'one-time';
      transaction?: string;
      created_at: string;
      updated_at: string;
      mode: 'test' | 'live';
    };
    subscription?: {
      id: string;
      object: 'subscription';
      product: string;
      customer: string;
      status: 'active' | 'canceled' | 'past_due';
      current_period_start_date: string;
      current_period_end_date: string;
      metadata?: Record<string, any>;
      mode: 'test' | 'live';
    };
    status: 'completed' | 'pending' | 'failed' | 'cancelled';
    metadata?: Record<string, any>;
    mode: 'test' | 'live';
  };
}

// 向后兼容的旧格式（如果 Creem 使用）
export interface CreamPaymentWebhook {
  order_id: string;
  payment_id: string;
  status: 'success' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  payment_method?: string;
  metadata?: Record<string, any>;
  timestamp: string;
  signature?: string; // 用于验证webhook的签名
}

export interface SubscriptionPlanInfo {
  name: 'basic' | 'pro' | 'studio';
  price: number; // 美元
  credits: number; // 每月积分
  product_id?: string; // Cream产品ID
}

export interface CreditPackageInfo {
  name: string;
  credits: number;
  price: number; // 美元
  product_id?: string; // Cream产品ID
}

