/**
 * Cream支付配置
 */

export const CREEM_CONFIG = {
  // Creem API配置（从环境变量读取）
  // 根据 Creem API 文档: https://docs.creem.io/api-reference/introduction
  apiKey: process.env.CREEM_API_KEY || '',
  apiSecret: process.env.CREEM_API_SECRET || '', // 保留用于其他可能的用途
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET || '',
  // 支持 CREEM_API_URL（完整URL）或 CREEM_BASE_URL（基础URL）
  apiUrl: process.env.CREEM_API_URL || process.env.CREEM_BASE_URL || 'https://api.creem.io',
  // Creem API 结账端点：POST /checkouts（不是 /v1/checkouts）
  // 文档: https://docs.creem.io/checkout-flow
  checkoutEndpoint: process.env.CREEM_CHECKOUT_ENDPOINT || '/checkouts',
  successUrl: process.env.CREEM_SUCCESS_URL || process.env.CREEM_RETURN_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment/success`,
  cancelUrl: process.env.CREEM_CANCEL_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment/cancel`,
  // 客户支持邮箱（用于 Creem 审核和客户支持）
  supportEmail: process.env.SUPPORT_EMAIL || 'andy@adflurrytech.com',
  // 客户支持页面URL
  supportUrl: process.env.SUPPORT_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/contact`,
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
    credits: 1500, // 按15积分/秒（720p费率）计算，确保70%+利润率
    product_id: (process.env.CREEM_PRODUCT_ID_BASIC || '').trim(), // 从环境变量读取或直接填写
  },
  pro: {
    price: 39.99,
    credits: 3500, // 按24积分/秒（1080p费率）计算，确保70%+利润率
    product_id: (process.env.CREEM_PRODUCT_ID_PRO || '').trim(),
  },
  studio: {
    price: 129.99,
    credits: 10000, // 按24积分/秒（1080p费率）计算，确保70%+利润率
    product_id: (process.env.CREEM_PRODUCT_ID_STUDIO || '').trim(),
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
    product_id: (process.env.CREEM_PRODUCT_ID_SMALL_PACK || '').trim(), // 从环境变量读取或直接填写
  },
  'Medium Pack': {
    credits: 1000,
    price: 14.99,
    product_id: (process.env.CREEM_PRODUCT_ID_MEDIUM_PACK || '').trim(),
  },
  'Large Pack': {
    credits: 2500,
    price: 29.99,
    product_id: (process.env.CREEM_PRODUCT_ID_LARGE_PACK || '').trim(),
  },
  'Pro Bundle': {
    credits: 5000,
    price: 49.99,
    product_id: (process.env.CREEM_PRODUCT_ID_PRO_BUNDLE || '').trim(),
  },
};

