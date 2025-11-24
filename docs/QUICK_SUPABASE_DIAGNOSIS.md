# Supabase 连接快速诊断

## 快速检查步骤

### 1. 访问诊断 API

在浏览器中打开：
```
http://localhost:3000/api/diagnose/supabase
```

或者在浏览器控制台运行：
```javascript
fetch('/api/diagnose/supabase')
  .then(r => r.json())
  .then(data => {
  })
  .catch(e => {});
```

### 2. 检查环境变量

确认 `.env.local` 文件存在且包含：
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. 测试直接连接

在浏览器控制台运行（替换为你的实际 URL 和 Key）：
```javascript
const url = 'YOUR_SUPABASE_URL';
const key = 'YOUR_ANON_KEY';

fetch(`${url}/rest/v1/`, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
})
.then(r => {})
.catch(e => {});
```

### 4. 检查网络连接

如果直接访问 Supabase Dashboard 可以，但代码中无法连接，可能是：

1. **DNS 缓存问题**：尝试清除 DNS 缓存
   - Windows: `ipconfig /flushdns`
   - Mac/Linux: `sudo dscacheutil -flushcache`

2. **防火墙/代理问题**：检查是否有防火墙或代理阻止连接

3. **Next.js 服务器问题**：重启开发服务器
   ```bash
   # 停止服务器 (Ctrl+C)
   # 然后重新启动
   npm run dev
   ```

4. **环境变量未加载**：确认 `.env.local` 文件在项目根目录，并重启服务器

### 5. 检查 Supabase 项目状态

1. 访问 https://app.supabase.com/
2. 确认项目状态为 "Active"
3. 检查项目设置 > API 中的 URL 和 Key 是否正确

### 6. 常见错误及解决方案

#### "fetch failed" 或 "Connect Timeout"
- **原因**：网络连接问题或超时
- **解决**：
  - 检查网络连接
  - 尝试使用不同的网络（如手机热点）
  - 检查是否有代理或 VPN 影响

#### "Unauthorized" 或 401
- **原因**：API Key 无效或过期
- **解决**：
  - 检查 `.env.local` 中的 Key 是否正确
  - 在 Supabase Dashboard 中重新生成 Key
  - 确认项目未被暂停

#### "环境变量未正确配置"
- **原因**：环境变量未设置或未加载
- **解决**：
  - 确认 `.env.local` 文件存在
  - 确认变量名正确（`NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`）
  - 重启开发服务器

## 最新改进

我们已经添加了以下改进来处理连接问题：

1. **30秒超时设置**：所有 Supabase 请求现在有 30 秒超时
2. **更好的错误信息**：提供更详细的错误描述
3. **重试逻辑**：`getUserWithRetry` 函数会自动重试网络错误

如果问题仍然存在，请：
1. 运行诊断 API 并查看详细错误信息
2. 检查浏览器控制台和服务器日志
3. 尝试直接访问 Supabase Dashboard 确认服务状态

