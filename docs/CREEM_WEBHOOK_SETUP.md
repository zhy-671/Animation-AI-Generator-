# Cream支付Webhook URL配置指南

## Webhook URL格式

根据项目结构，Webhook路由位于：`app/api/payment/webhook/route.ts`

### 开发环境（本地测试）

```
http://localhost:3000/api/payment/webhook
```

**注意**：本地开发环境需要使用内网穿透工具（如 ngrok）才能让Cream访问到本地服务。

**使用 ngrok 的步骤：**
1. 安装 ngrok：https://ngrok.com/
2. 启动本地开发服务器：`npm run dev`
3. 在另一个终端运行：`ngrok http 3000`
4. 使用 ngrok 提供的 HTTPS URL，例如：
   ```
   https://abc123.ngrok.io/api/payment/webhook
   ```

### 生产环境

```
https://your-domain.com/api/payment/webhook
```

**示例：**
- 如果您的域名是 `animationaigenerator.com`，则Webhook URL为：
  ```
  https://animationaigenerator.com/api/payment/webhook
  ```
- 如果您的域名是 `www.animationaigenerator.com`，则Webhook URL为：
  ```
  https://www.animationaigenerator.com/api/payment/webhook
  ```

## 在Cream支付后台配置Webhook

### 步骤1：登录Cream支付后台

1. 访问Cream支付管理后台
2. 登录您的账户

### 步骤2：进入Webhook设置

1. 找到 **设置** 或 **Settings** 菜单
2. 选择 **Webhook配置** 或 **Webhook Settings**
3. 点击 **添加Webhook** 或 **Add Webhook**

### 步骤3：填写Webhook信息

**Webhook URL：**
```
生产环境：https://your-domain.com/api/payment/webhook
开发环境：https://your-ngrok-url.ngrok.io/api/payment/webhook
```

**Webhook事件（选择需要监听的事件）：**
- ✅ `payment.success` - 支付成功
- ✅ `payment.failed` - 支付失败
- ✅ `payment.cancelled` - 支付取消
- ✅ `payment.refunded` - 支付退款（如果支持）

**Webhook签名密钥：**
- 在Cream后台生成或设置Webhook签名密钥
- 将密钥复制到项目的 `.env.local` 文件中：
  ```env
  CREEM_WEBHOOK_SECRET=your_webhook_secret_from_creem
  ```

### 步骤4：保存并测试

1. 点击 **保存** 或 **Save**
2. 使用Cream提供的测试功能发送测试Webhook
3. 检查服务器日志，确认Webhook接收正常

## 环境变量配置

在 `.env.local` 文件中配置：

```env
# 应用基础URL（用于支付回调和Webhook）
NEXT_PUBLIC_APP_URL=https://your-domain.com  # 生产环境
# NEXT_PUBLIC_APP_URL=http://localhost:3000  # 开发环境

# Cream支付配置
CREEM_API_KEY=your_creem_api_key
CREEM_API_SECRET=your_creem_api_secret
CREEM_WEBHOOK_SECRET=your_webhook_secret_from_creem
CREEM_BASE_URL=https://api.creem.com  # 根据实际API地址修改

# 支付回调URL（自动生成，也可手动配置）
CREEM_RETURN_URL=https://your-domain.com/payment/success
CREEM_CANCEL_URL=https://your-domain.com/payment/cancel
```

## 重要注意事项

### 1. HTTPS要求
- ✅ **生产环境必须使用HTTPS**
- ❌ Cream不会向HTTP地址发送Webhook（安全要求）
- 本地开发需要使用ngrok等工具提供HTTPS

### 2. Webhook签名验证
- 确保设置了 `CREEM_WEBHOOK_SECRET`
- Webhook签名验证在生产环境是强制性的
- 签名验证逻辑在 `lib/payment/creem.ts` 中实现

### 3. 网络访问
- 确保服务器可以从公网访问
- 检查防火墙设置，确保443端口（HTTPS）开放
- 如果使用Vercel/Netlify等平台，确保已正确部署

### 4. 测试Webhook
- 使用Cream提供的测试功能
- 检查服务器日志确认接收
- 验证积分是否正确添加

## 验证Webhook配置

### 方法1：查看服务器日志

当Cream发送Webhook时，检查服务器日志：
```
[INFO] Webhook received: payment.success
[INFO] Order processed: order_id=xxx
[INFO] Credits added: amount=200
```

### 方法2：检查数据库

1. 查看 `payment_orders` 表，确认订单状态更新为 `completed`
2. 查看 `anim_credits_history` 表，确认积分记录已添加
3. 查看 `anim_customers` 表，确认积分余额已更新

### 方法3：使用Cream测试功能

1. 在Cream后台找到 **测试Webhook** 功能
2. 发送测试事件
3. 检查应用是否收到并正确处理

## 常见问题

### Q: Webhook没有收到？
- ✅ 检查URL是否正确（注意HTTPS）
- ✅ 检查服务器是否可以从公网访问
- ✅ 检查防火墙设置
- ✅ 查看Cream后台的Webhook日志

### Q: Webhook签名验证失败？
- ✅ 确认 `CREEM_WEBHOOK_SECRET` 已正确设置
- ✅ 确认密钥与Cream后台设置的密钥一致
- ✅ 检查签名验证逻辑是否正确实现

### Q: 本地开发如何测试？
- ✅ 使用ngrok等内网穿透工具
- ✅ 将ngrok的HTTPS URL配置到Cream后台
- ✅ 注意ngrok免费版URL会变化，需要更新配置

### Q: 生产环境部署后Webhook不工作？
- ✅ 确认域名DNS已正确配置
- ✅ 确认SSL证书已安装（HTTPS）
- ✅ 确认服务器可以接收POST请求
- ✅ 检查Vercel/Netlify等平台的函数日志

## 安全建议

1. **使用HTTPS**：生产环境必须使用HTTPS
2. **验证签名**：始终验证Webhook签名
3. **IP白名单**（可选）：如果Cream提供IP列表，可以添加IP白名单
4. **日志记录**：记录所有Webhook请求，便于审计
5. **错误处理**：妥善处理Webhook错误，避免重复处理

