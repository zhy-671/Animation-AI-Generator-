# Creem 客户支持邮箱配置指南

## 概述

Creem 审核要求提供可联系的客户支持邮箱。本指南说明如何配置和提供客户支持邮箱信息。

## 客户支持邮箱

**默认客户支持邮箱**: `andy@adflurrytech.com`

该邮箱已在以下位置使用：
- 联系页面 (`/contact`)
- 隐私政策页面 (`/privacy`)
- 服务条款页面 (`/terms`)
- AI 披露页面 (`/ai-disclosure`)

## 配置方式

### 1. 在代码中配置（已完成）

客户支持邮箱已在 `lib/payment/config.ts` 中配置：

```typescript
export const CREEM_CONFIG = {
  // ... 其他配置
  supportEmail: process.env.SUPPORT_EMAIL || 'andy@adflurrytech.com',
  supportUrl: process.env.SUPPORT_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/contact`,
};
```

### 2. 在 Creem 后台配置

登录 Creem 支付后台，在以下位置填写客户支持邮箱：

#### 步骤 1：进入设置页面
1. 登录 Creem 支付管理后台
2. 导航到 **设置 (Settings)** 或 **商户设置 (Merchant Settings)**
3. 找到 **客户支持 (Customer Support)** 或 **联系信息 (Contact Information)** 部分

#### 步骤 2：填写支持邮箱
- **客户支持邮箱**: `andy@adflurrytech.com`
- **客户支持页面URL**: `https://animationaigenerator.com/contact`（或您的实际域名）

#### 步骤 3：保存设置
保存配置后，Creem 审核团队将能够看到您的客户支持联系方式。

## 环境变量配置（可选）

如果需要使用不同的支持邮箱，可以在 `.env.local` 文件中设置：

```env
# 客户支持配置
SUPPORT_EMAIL=your-support@example.com
SUPPORT_URL=https://your-domain.com/contact
```

## 验证配置

### 1. 检查联系页面
访问 `/contact` 页面，确认邮箱地址正确显示。

### 2. 检查配置文件
确认 `lib/payment/config.ts` 中的 `supportEmail` 配置正确。

### 3. 检查 Creem 后台
登录 Creem 后台，确认客户支持邮箱已填写并保存。

## 常见问题

### Q: Creem 审核仍然提示缺少客户支持邮箱？
A: 请确保：
1. 在 Creem 后台的商户设置中已填写客户支持邮箱
2. 联系页面 (`/contact`) 可以正常访问
3. 邮箱地址格式正确（例如：`andy@adflurrytech.com`）

### Q: 如何更改客户支持邮箱？
A: 
1. 更新 `lib/payment/config.ts` 中的默认值
2. 更新所有页面中的邮箱地址（联系页面、隐私政策、服务条款等）
3. 在 Creem 后台更新邮箱配置
4. 如果使用环境变量，更新 `.env.local` 中的 `SUPPORT_EMAIL`

### Q: 支持邮箱需要验证吗？
A: 建议验证邮箱地址，确保能够正常接收客户咨询邮件。Creem 可能会发送测试邮件验证邮箱有效性。

## 相关文件

- `lib/payment/config.ts` - 支付配置文件（包含支持邮箱配置）
- `app/contact/page.tsx` - 联系页面（显示支持邮箱）
- `app/privacy/page.tsx` - 隐私政策页面（包含联系邮箱）
- `app/terms/page.tsx` - 服务条款页面（包含联系邮箱）
- `docs/CREEM_PAYMENT_INTEGRATION.md` - Creem 支付集成文档

## 联系信息总结

- **客户支持邮箱**: `andy@adflurrytech.com`
- **联系页面**: `https://animationaigenerator.com/contact`
- **网站**: `https://animationaigenerator.com`

