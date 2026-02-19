# Supabase 连接问题排查指南

## 快速诊断

访问以下 URL 进行自动诊断：
```
http://localhost:3000/api/diagnose/supabase
```

或者在浏览器中打开开发工具，在控制台运行：
```javascript
fetch('/api/diagnose/supabase').then(r => r.json()).then(() => {})
```

## 常见问题及解决方案

### 1. 环境变量未配置

**症状：** 错误提示 "环境变量未正确配置"

**解决方案：**
1. 检查项目根目录是否有 `.env.local` 文件
2. 确认文件中包含以下变量：
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
3. 重启开发服务器（`npm run dev`）

### 2. 网络连接超时

**症状：** 错误提示 "Connect Timeout" 或 "fetch failed"

**可能原因：**
- 网络连接不稳定
- 防火墙阻止连接
- Supabase 服务暂时不可用
- DNS 解析问题

**解决方案：**
1. 检查网络连接
2. 尝试访问 Supabase Dashboard: https://app.supabase.com/
3. 检查 Supabase 服务状态: https://status.supabase.com/
4. 如果使用代理，检查代理设置
5. 尝试使用不同的网络（如手机热点）

### 3. 认证错误

**症状：** 错误提示 "Unauthorized" 或 401 状态码

**可能原因：**
- API Key 已过期或无效
- 项目已被暂停或删除
- RLS (Row Level Security) 策略限制

**解决方案：**
1. 登录 Supabase Dashboard
2. 进入项目设置 > API
3. 确认 Project URL 和 anon key 是否正确
4. 如果 key 已更改，更新 `.env.local` 文件
5. 检查 RLS 策略是否允许当前操作

### 4. 数据库连接失败

**症状：** 错误提示 "数据库查询失败" 或 PostgreSQL 错误

**可能原因：**
- 表不存在
- RLS 策略限制
- 数据库连接池耗尽
- 查询超时

**解决方案：**
1. 检查表是否存在：在 Supabase Dashboard > Table Editor 中查看
2. 检查 RLS 策略：在 Supabase Dashboard > Authentication > Policies 中查看
3. 检查数据库连接数：在 Supabase Dashboard > Database > Connection Pooling 中查看
4. 优化查询，减少超时可能性

### 5. 服务端客户端创建失败

**症状：** 错误提示 "客户端创建失败"

**可能原因：**
- `cookies()` 在 Edge Runtime 中不可用
- 环境变量在运行时未加载

**解决方案：**
1. 确认使用的是 `@/lib/supabase/server` 而不是 `@/lib/supabase/client`
2. 在 API Routes 中使用 `await createClient()`
3. 检查 Next.js 配置是否正确

## 手动检查步骤

### 步骤 1: 检查环境变量

在项目根目录创建或检查 `.env.local` 文件：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 步骤 2: 验证 Supabase 项目状态

1. 访问 https://app.supabase.com/
2. 登录并选择你的项目
3. 确认项目状态为 "Active"
4. 检查项目设置 > API 中的 URL 和 Key

### 步骤 3: 测试基本连接

在浏览器控制台运行：

```javascript
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_URL';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_KEY';

fetch(`${url}/rest/v1/`, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
}).then(r => {})
  .catch(e => {});
```

### 步骤 4: 检查网络连接

```bash
# 测试 DNS 解析（替换为你的 Supabase URL）
ping your-project.supabase.co

# 测试 HTTPS 连接
curl -I https://your-project.supabase.co
```

## 获取帮助

如果以上方法都无法解决问题：

1. 查看 Supabase 官方文档: https://supabase.com/docs
2. 检查 Supabase 服务状态: https://status.supabase.com/
3. 查看 Supabase 社区论坛: https://github.com/supabase/supabase/discussions
4. 联系 Supabase 支持

## 诊断 API 返回的字段说明

- `checks`: 各项检查的结果
- `errors`: 发现的错误列表
- `warnings`: 警告信息
- `summary`: 总体状态摘要
  - `totalChecks`: 总检查数
  - `passed`: 通过的检查数
  - `failed`: 失败的检查数
  - `warnings`: 警告数
  - `overallStatus`: 总体状态

