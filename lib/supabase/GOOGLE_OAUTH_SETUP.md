# Google OAuth 登录配置指南

## 在 Supabase Dashboard 中配置 Google OAuth

### 1. 获取 Google OAuth 凭证

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 Google+ API：
   - 进入 "APIs & Services" > "Library"
   - 搜索 "Google+ API" 并启用
4. 创建 OAuth 2.0 凭证：
   - 进入 "APIs & Services" > "Credentials"
   - 点击 "Create Credentials" > "OAuth client ID"
   - 选择 "Web application"
   - 添加授权重定向 URI：
     - 开发环境：`http://localhost:3000/auth/callback`
     - 生产环境：`https://yourdomain.com/auth/callback`
   - 保存后获取 **Client ID** 和 **Client Secret**

### 2. 在 Supabase 中配置 Google Provider

1. 登录 [Supabase Dashboard](https://app.supabase.com/)
2. 选择你的项目
3. 进入 **Authentication** > **Providers**
4. 找到 **Google** 并启用
5. 填入以下信息：
   - **Client ID (for OAuth)**: 从 Google Cloud Console 获取
   - **Client Secret (for OAuth)**: 从 Google Cloud Console 获取
6. 点击 **Save**

### 3. 配置重定向 URL

在 Supabase Dashboard 中：
1. 进入 **Authentication** > **URL Configuration**
2. 添加以下重定向 URL：
   - `http://localhost:3000/auth/callback` (开发环境)
   - `https://yourdomain.com/auth/callback` (生产环境)

### 4. 测试 Google 登录

1. 启动开发服务器：`npm run dev`
2. 访问登录页面：`http://localhost:3000/login`
3. 点击 "Sign in with Google" 按钮
4. 应该会重定向到 Google 登录页面
5. 登录成功后，会重定向回你的应用

## 注意事项

- **开发环境**：确保 Google Cloud Console 中的重定向 URI 包含 `http://localhost:3000/auth/callback`
- **生产环境**：部署后，需要在 Google Cloud Console 和 Supabase Dashboard 中都添加生产环境的 URL
- **安全**：不要将 Client Secret 暴露在客户端代码中，Supabase 会在服务端处理

## 故障排除

### 错误：redirect_uri_mismatch
- 检查 Google Cloud Console 中的授权重定向 URI 是否与 Supabase 中的配置一致
- 确保 URL 完全匹配（包括协议、域名、端口和路径）

### 错误：invalid_client
- 检查 Client ID 和 Client Secret 是否正确
- 确保在 Supabase Dashboard 中正确保存了凭证

### 登录后没有重定向
- 检查 `app/auth/callback/route.ts` 是否正确配置
- 确保 Supabase Dashboard 中的重定向 URL 配置正确

