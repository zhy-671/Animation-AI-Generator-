# Cream支付集成说明

本文档说明如何配置和使用Cream支付系统。

## 环境变量配置

在 `.env.local` 文件中添加以下环境变量：

```env
# Cream支付配置
CREEM_API_KEY=your_creem_api_key
CREEM_API_SECRET=your_creem_api_secret
CREEM_WEBHOOK_SECRET=your_webhook_secret
CREEM_BASE_URL=https://api.creem.com  # 根据实际API地址修改
NEXT_PUBLIC_APP_URL=http://localhost:3000  # 生产环境改为实际域名
```

## 数据库迁移

运行以下迁移脚本创建支付订单表：

```bash
# 在Supabase Dashboard中运行
supabase/migrations/006_create_payment_orders.sql
```

## 功能说明

### 1. 订阅功能
- 用户可以选择 Basic、Pro 或 Studio 订阅计划
- 订阅成功后：
  - 用户获得对应的月度积分
  - 更新用户的订阅计划信息
  - 记录积分历史

### 2. 积分购买功能
- 用户可以选择不同的积分包（Small Pack、Medium Pack、Large Pack、Pro Bundle）
- 购买成功后：
  - 用户获得对应的积分
  - 记录积分历史

### 3. 积分扣除功能
- 用户操作（生成视频、图片、分镜）时自动扣除积分
- 扣除成功后：
  - 更新用户积分余额
  - 记录积分历史
  - 前端实时更新积分显示

### 4. 实时积分更新
- Header组件监听积分更新事件
- 支付成功后自动刷新积分显示
- 积分扣除后自动更新显示

## API路由

### `/api/payment/create-order` (POST)
创建支付订单

**请求体：**
```json
{
  "order_type": "subscription" | "credits",
  "plan_name": "basic" | "pro" | "studio",  // 仅订阅时
  "credit_package_name": "Small Pack" | ...,  // 仅购买积分时
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "order_id": "uuid",
    "payment_url": "https://creem.com/pay/...",
    "creem_order_id": "creem_order_id"
  }
}
```

### `/api/payment/webhook` (POST)
Cream支付回调webhook

**配置：**
在Cream支付后台配置webhook URL为：`https://your-domain.com/api/payment/webhook`

### `/api/credits/operate` (POST)
积分操作（增加/扣除）

**请求体：**
```json
{
  "amount": 100,
  "type": "add" | "subtract",
  "description": "描述",
  "metadata": {}
}
```

**响应：**
```json
{
  "success": true,
  "credits": 500  // 更新后的积分余额
}
```

### `/api/credits/balance` (GET)
获取积分余额

**响应：**
```json
{
  "credits": 500
}
```

## 前端使用

### 订阅计划
```typescript
import { subscribeToPlan } from '@/lib/payment/client';

// 订阅Basic计划
await subscribeToPlan('basic');
```

### 购买积分
```typescript
import { purchaseCredits } from '@/lib/payment/client';

// 购买Small Pack积分包
await purchaseCredits('Small Pack');
```

### 刷新积分显示
```typescript
import { refreshCreditsBalance } from '@/lib/payment/client';

// 触发积分更新事件
refreshCreditsBalance();
```

## 注意事项

1. **Cream API集成**：`lib/payment/creem.ts` 中的API调用需要根据实际的Cream API文档进行调整
2. **Webhook签名验证**：`verifyCreemWebhookSignature` 函数需要根据Cream的实际签名算法实现
3. **支付回调URL**：确保webhook URL可以从公网访问
4. **错误处理**：所有支付相关操作都有错误处理，确保用户体验

## 测试流程

1. 用户登录
2. 访问 `/pricing` 页面
3. 选择订阅计划或积分包
4. 点击"Get Started"或"Buy Credits"
5. 跳转到Cream支付页面
6. 完成支付
7. 返回应用，积分自动更新

## 数据库表结构

### payment_orders
- `id`: UUID主键
- `customer_id`: 关联anim_customers表
- `order_type`: 'subscription' | 'credits'
- `plan_name`: 订阅计划名称
- `credit_package_name`: 积分包名称
- `credits_amount`: 积分数量
- `amount`: 支付金额
- `status`: 订单状态
- `creem_order_id`: Cream订单ID
- `creem_payment_id`: Cream支付ID

### anim_credits_history
- 记录所有积分变动历史
- 包括订阅、购买、扣除等操作

