# 支付安全措施说明

## 🔒 已实施的安全措施

### 1. **禁止直接增加积分**
- `/api/credits/operate` API现在禁止用户直接调用增加积分
- 增加积分必须提供有效的已完成支付订单ID
- 验证订单存在、已完成、且积分数量匹配

### 2. **Webhook签名验证**
- 所有webhook请求必须通过签名验证
- 使用HMAC-SHA256验证签名（需要根据Cream API文档实现）
- 生产环境必须设置`CREEM_WEBHOOK_SECRET`

### 3. **订单金额验证**
- Webhook中的金额必须与订单金额匹配（允许0.01误差）
- 防止金额篡改攻击

### 4. **幂等性检查**
- 检查订单是否已经处理过
- 检查积分历史记录，防止重复添加积分
- 使用数据库约束确保唯一性

### 5. **订单状态验证**
- 只处理`pending`或`processing`状态的订单
- 使用数据库约束确保状态一致性

### 6. **双重验证（可选）**
- 可以向Cream API查询订单状态进行二次验证
- 确保webhook数据与Cream API数据一致

### 7. **数据库约束**
- `creem_order_id`唯一约束
- 积分数量和金额必须为正数
- 索引优化查询性能

### 8. **日志记录**
- 记录所有安全相关事件
- 记录IP地址、时间戳等信息
- 便于追踪和审计

## ⚠️ 需要完成的安全措施

### 1. **实现Webhook签名验证**
在`lib/payment/creem.ts`中实现`verifyCreemWebhookSignature`函数：
```typescript
// 根据Cream API文档实现HMAC-SHA256签名验证
const crypto = require('crypto');
const expectedSignature = crypto
  .createHmac('sha256', CREEM_CONFIG.webhookSecret)
  .update(payload)
  .digest('hex');
return crypto.timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(expectedSignature)
);
```

### 2. **IP白名单（可选但推荐）**
在webhook路由中添加Cream IP白名单验证：
```typescript
const CREEM_IP_WHITELIST = ['xxx.xxx.xxx.xxx']; // Cream的IP地址
if (!CREEM_IP_WHITELIST.includes(creemIp)) {
  return NextResponse.json({ error: 'Unauthorized IP' }, { status: 403 });
}
```

### 3. **Rate Limiting**
添加速率限制，防止webhook被恶意调用：
```typescript
// 使用中间件限制webhook调用频率
```

## 🛡️ 安全最佳实践

1. **永远不要信任客户端**
   - 所有积分操作必须在服务端验证
   - 客户端只能调用扣除积分，不能增加积分

2. **使用HTTPS**
   - 确保所有API调用使用HTTPS
   - Webhook URL必须是HTTPS

3. **环境变量安全**
   - 不要在代码中硬编码密钥
   - 使用环境变量存储敏感信息
   - 定期轮换密钥

4. **监控和告警**
   - 监控异常的积分增加
   - 设置告警阈值
   - 定期审计积分历史记录

5. **数据库安全**
   - 使用RLS（Row Level Security）
   - 限制数据库访问权限
   - 定期备份数据

## 📋 安全检查清单

- [x] 禁止用户直接增加积分
- [x] Webhook签名验证框架
- [x] 订单金额验证
- [x] 幂等性检查
- [x] 订单状态验证
- [x] 数据库约束
- [x] 日志记录
- [ ] 实现完整的签名验证（需要Cream API文档）
- [ ] IP白名单（可选）
- [ ] Rate Limiting（可选）
- [ ] 监控和告警系统

