/**
 * Cream支付配置
 */

export const CREEM_CONFIG = {
  // Cream API配置（从环境变量读取）
  apiKey: process.env.CREEM_API_KEY || '',
  apiSecret: process.env.CREEM_API_SECRET || '',
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET || '',
  baseUrl: process.env.CREEM_BASE_URL || 'https://api.creem.com', // 根据实际API地址修改
  returnUrl: process.env.CREEM_RETURN_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment/success`,
  cancelUrl: process.env.CREEM_CANCEL_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment/cancel`,
};

// 订阅计划配置
// 在Cream后台创建订阅产品后，将对应的product_id填入
export const SUBSCRIPTION_PLANS: Record<string, { 
  price: number; 
  credits: number;
  product_id?: string; // Cream产品ID（必需）
}> = {
  basic: {
    price: 19.99,
    credits: 200,
    product_id: process.env.CREEM_PRODUCT_ID_BASIC || '', // 从环境变量读取或直接填写
  },
  pro: {
    price: 39.99,
    credits: 700,
    product_id: process.env.CREEM_PRODUCT_ID_PRO || '',
  },
  studio: {
    price: 129.99,
    credits: 2000,
    product_id: process.env.CREEM_PRODUCT_ID_STUDIO || '',
  },
};

// 积分包配置
// 在Cream后台创建积分包产品后，将对应的product_id填入
export const CREDIT_PACKAGES: Record<string, { 
  credits: number; 
  price: number;
  product_id?: string; // Cream产品ID（必需）
}> = {
  'Small Pack': {
    credits: 300,
    price: 4.99,
    product_id: process.env.CREEM_PRODUCT_ID_SMALL_PACK || '', // 从环境变量读取或直接填写
  },
  'Medium Pack': {
    credits: 1000,
    price: 14.99,
    product_id: process.env.CREEM_PRODUCT_ID_MEDIUM_PACK || '',
  },
  'Large Pack': {
    credits: 2500,
    price: 29.99,
    product_id: process.env.CREEM_PRODUCT_ID_LARGE_PACK || '',
  },
  'Pro Bundle': {
    credits: 5000,
    price: 49.99,
    product_id: process.env.CREEM_PRODUCT_ID_PRO_BUNDLE || '',
  },
};

