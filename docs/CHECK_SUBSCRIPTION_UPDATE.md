# 检查购买成功后数据库更新

## 检查步骤

### 1. 检查 Webhook 日志

购买成功后，检查服务器日志中是否有以下信息：

```
=== Updating subscription plan ===
Customer ID: [customer_id]
Plan name from metadata: [plan_name]
Expires at: [expires_at]
✅ Updated subscription plan to [plan_name] for customer [customer_id]
✅ Verified subscription plan in database: { subscription_plan: '[plan_name]', subscription_expires_at: '...' }
```

如果看到错误日志：
```
❌ Error updating subscription plan: [error details]
```

### 2. 检查数据库（Supabase Dashboard）

#### 方法 1: 通过 Table Editor

1. 登录 Supabase Dashboard
2. 进入 **Table Editor** > `anim_customers` 表
3. 找到你的用户记录
4. 检查以下字段：
   - `subscription_plan`: 应该是 `basic`, `pro`, 或 `studio`
   - `subscription_expires_at`: 应该是未来的日期时间

#### 方法 2: 通过 SQL Editor

```sql
-- 查看你的订阅计划（替换为你的邮箱）
SELECT 
  ac.id as customer_id,
  au.email,
  ac.subscription_plan,
  ac.subscription_expires_at,
  CASE 
    WHEN ac.subscription_plan IS NULL THEN 'No subscription'
    WHEN ac.subscription_expires_at IS NULL THEN 'No expiration date'
    WHEN ac.subscription_expires_at > NOW() THEN 'Active'
    ELSE 'Expired'
  END as subscription_status,
  ac.credits_balance
FROM anim_customers ac
JOIN auth.users au ON au.id = ac.user_id
WHERE au.email = 'your-email@example.com';
```

### 3. 检查支付订单记录

```sql
-- 查看最近的支付订单（替换为你的邮箱）
SELECT 
  po.id,
  po.order_type,
  po.plan_name,
  po.status,
  po.amount,
  po.creem_order_id,
  po.created_at,
  po.completed_at
FROM payment_orders po
JOIN anim_customers ac ON ac.id = po.customer_id
JOIN auth.users au ON au.id = ac.user_id
WHERE au.email = 'your-email@example.com'
ORDER BY po.created_at DESC
LIMIT 10;
```

### 4. 检查 Webhook 事件

如果使用 Creem 支付，检查 Creem Dashboard 中的 Webhook 事件：
- 查看是否有 `checkout.completed` 或 `subscription.active` 事件
- 检查事件是否成功发送到你的 webhook URL
- 查看事件响应状态码（应该是 200）

## 常见问题排查

### 问题 1: 数据库字段为空

**可能原因：**
1. Webhook 未正确触发
2. `metadata.plan_name` 缺失
3. `checkout.subscription` 不存在
4. 更新操作失败但未记录错误

**解决方法：**
1. 检查服务器日志中的 webhook 处理记录
2. 确认 `metadata` 中是否包含 `plan_name`
3. 检查 `checkout.subscription` 是否存在

### 问题 2: 更新失败但无错误日志

**可能原因：**
1. RLS (Row Level Security) 策略阻止更新
2. 数据库连接问题
3. 字段类型不匹配

**解决方法：**
1. 检查 Supabase RLS 策略
2. 查看服务器错误日志
3. 验证字段类型是否正确

### 问题 3: 更新成功但立即被覆盖

**可能原因：**
1. 多个 webhook 事件同时处理
2. 其他代码逻辑覆盖了订阅计划

**解决方法：**
1. 检查是否有多个 webhook 事件
2. 检查是否有其他代码更新订阅计划

## 验证更新是否成功

### 通过 API 验证

在浏览器控制台运行：
```javascript
// 1. 检查订阅计划 API
fetch('/api/subscription/plan')
  .then(r => r.json())
  .then(data => {
  });

// 2. 检查客户信息（如果 API 存在）
fetch('/api/customer/info')
  .then(r => r.json())
  .then(data => {
  });
```

### 手动验证 SQL

```sql
-- 完整验证查询
SELECT 
  au.email,
  au.id as user_id,
  ac.id as customer_id,
  ac.subscription_plan,
  ac.subscription_expires_at,
  ac.credits_balance,
  CASE 
    WHEN ac.subscription_plan IS NULL THEN 'NULL (Free)'
    WHEN ac.subscription_expires_at IS NULL THEN 'NULL (No expiration)'
    WHEN ac.subscription_expires_at > NOW() THEN 'Active'
    ELSE 'Expired'
  END as status,
  -- 最近的订单
  (SELECT COUNT(*) FROM payment_orders po WHERE po.customer_id = ac.id) as total_orders,
  (SELECT MAX(created_at) FROM payment_orders po WHERE po.customer_id = ac.id) as last_order_date
FROM auth.users au
LEFT JOIN anim_customers ac ON ac.user_id = au.id
WHERE au.email = 'your-email@example.com';
```

## 调试信息

如果更新失败，检查以下信息：

1. **Webhook 日志**：查看服务器日志中的详细错误信息
2. **Metadata 内容**：确认 `metadata.plan_name` 的值
3. **Customer ID**：确认 `customerId` 是否正确
4. **数据库权限**：确认 RLS 策略是否允许更新

## 增强的日志输出

更新后的代码会在日志中输出：
- ✅ 更新前的状态
- ✅ 更新操作详情
- ✅ 更新后的验证结果
- ❌ 详细的错误信息（如果有）

查看服务器日志即可了解更新过程的详细信息。

