# 订阅ID配置说明

## 订阅ID配置位置

订阅ID可以在以下位置配置：

### 1. **环境变量配置（推荐）**

在 `.env.local` 文件中添加：

```env
# Cream订阅产品ID配置
# 在Cream后台创建订阅产品后，将对应的ID填入

# Basic计划
CREEM_SUBSCRIPTION_ID_BASIC=sub_basic_xxxxx
CREEM_PRODUCT_ID_BASIC=prod_basic_xxxxx

# Pro计划
CREEM_SUBSCRIPTION_ID_PRO=sub_pro_xxxxx
CREEM_PRODUCT_ID_PRO=prod_pro_xxxxx

# Studio计划
CREEM_SUBSCRIPTION_ID_STUDIO=sub_studio_xxxxx
CREEM_PRODUCT_ID_STUDIO=prod_studio_xxxxx
```

### 2. **代码中直接配置**

在 `lib/payment/config.ts` 文件中直接修改：

```typescript
export const SUBSCRIPTION_PLANS: Record<string, { 
  price: number; 
  credits: number;
  subscription_id?: string; // Cream订阅产品ID
  product_id?: string; // Cream产品ID
}> = {
  basic: {
    price: 19.99,
    credits: 200,
    subscription_id: 'sub_basic_xxxxx', // 直接填写Cream订阅ID
    product_id: 'prod_basic_xxxxx', // 直接填写Cream产品ID
  },
  // ...
};
```

## 如何获取Cream订阅ID

1. **登录Cream支付后台**
2. **进入产品管理** → **订阅产品**
3. **创建或选择订阅产品**
4. **复制产品ID**：
   - `subscription_id`: 订阅产品ID（用于订阅支付）
   - `product_id`: 产品ID（如果Cream需要）

## 配置优先级

1. **环境变量优先**：如果设置了环境变量，会优先使用环境变量
2. **代码配置**：如果没有环境变量，使用代码中的默认值
3. **空值处理**：如果都没有设置，订阅ID为空，Cream API可能使用其他方式识别（如plan_name）

## 使用说明

订阅ID会在创建支付订单时自动传递给Cream API：

- **subscription_id**: 用于标识订阅产品
- **product_id**: 用于标识产品（如果Cream需要）
- **plan_id**: 使用plan_name（'basic', 'pro', 'studio'）作为plan_id

## 注意事项

1. **订阅ID格式**：根据Cream API文档，确认ID的格式（可能是字符串、数字等）
2. **环境变量命名**：确保环境变量名称与代码中的一致
3. **测试**：配置后，测试订阅功能，确认Cream能正确识别订阅产品

