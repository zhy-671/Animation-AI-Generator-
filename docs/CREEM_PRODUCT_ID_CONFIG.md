# Cream产品ID配置说明

## 配置位置

### 方法1：环境变量配置（推荐）

在 `.env.local` 文件中添加：

```env
# Cream订阅产品ID配置
CREEM_PRODUCT_ID_BASIC=prod_basic_xxxxx
CREEM_PRODUCT_ID_PRO=prod_pro_xxxxx
CREEM_PRODUCT_ID_STUDIO=prod_studio_xxxxx

# Cream积分包产品ID配置
CREEM_PRODUCT_ID_SMALL_PACK=prod_small_pack_xxxxx
CREEM_PRODUCT_ID_MEDIUM_PACK=prod_medium_pack_xxxxx
CREEM_PRODUCT_ID_LARGE_PACK=prod_large_pack_xxxxx
CREEM_PRODUCT_ID_PRO_BUNDLE=prod_pro_bundle_xxxxx
```

### 方法2：代码中直接配置

在 `lib/payment/config.ts` 文件中直接修改：

```typescript
// 订阅计划
basic: {
  price: 19.99,
  credits: 200,
  product_id: 'prod_basic_xxxxx', // 直接填写Cream产品ID
},
pro: {
  price: 39.99,
  credits: 700,
  product_id: 'prod_pro_xxxxx',
},
studio: {
  price: 129.99,
  credits: 2000,
  product_id: 'prod_studio_xxxxx',
},

// 积分包
'Small Pack': {
  credits: 300,
  price: 4.99,
  product_id: 'prod_small_pack_xxxxx', // 直接填写Cream产品ID
},
'Medium Pack': {
  credits: 1000,
  price: 14.99,
  product_id: 'prod_medium_pack_xxxxx',
},
'Large Pack': {
  credits: 2500,
  price: 29.99,
  product_id: 'prod_large_pack_xxxxx',
},
'Pro Bundle': {
  credits: 5000,
  price: 49.99,
  product_id: 'prod_pro_bundle_xxxxx',
},
```

## 如何获取Cream产品ID

1. **登录Cream支付后台**
2. **进入产品管理** → **产品列表**
3. **创建或选择产品**：
   - 订阅产品：Basic、Pro、Studio
   - 一次性产品：Small Pack、Medium Pack、Large Pack、Pro Bundle
4. **复制产品ID**（格式可能是 `prod_xxxxx` 或其他格式）

## 配置说明

- **订阅计划**：每个订阅计划（Basic、Pro、Studio）都需要一个product_id
- **积分包**：每个积分包（Small Pack、Medium Pack、Large Pack、Pro Bundle）都需要一个product_id
- **自动传递**：创建订单时，系统会自动将对应的product_id传递给Cream API

## 使用流程

1. 用户在定价页面选择订阅或积分包
2. 系统根据选择获取对应的product_id
3. 创建Cream订单时，自动传递product_id
4. Cream使用product_id识别产品并处理支付

## 注意事项

1. **产品ID格式**：根据Cream API文档确认ID格式
2. **环境变量命名**：确保环境变量名称正确
3. **测试**：配置后测试订阅和积分购买功能

