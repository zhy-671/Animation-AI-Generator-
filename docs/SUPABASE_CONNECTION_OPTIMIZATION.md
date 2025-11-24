# Supabase 连接优化指南

## 已实施的优化措施

### 1. **超时设置**
- **之前**: 30秒超时
- **现在**: 60秒超时
- **原因**: 网络不稳定时，30秒可能不够，增加超时时间可以减少连接失败

### 2. **自动重试机制**
- **重试次数**: 最多3次（初始尝试 + 2次重试）
- **重试策略**: 指数退避（1秒、2秒、4秒）
- **重试条件**:
  - 网络错误（fetch failed, timeout, ECONNREFUSED 等）
  - 服务器错误（5xx 状态码）

### 3. **连接复用**
- 添加了 `Connection: keep-alive` 和 `Keep-Alive: timeout=60` 头部
- 有助于复用 TCP 连接，减少连接建立开销

### 4. **错误处理改进**
- 区分网络错误和业务错误
- 只对网络错误进行重试
- 提供更详细的错误信息

## 常见连接问题排查

### 问题 1: 间歇性连接失败

**可能原因**:
- 网络不稳定
- Supabase 服务器临时过载
- DNS 解析问题

**解决方案**:
1. 检查网络连接
2. 查看 Supabase Dashboard 状态页面
3. 使用诊断 API: `GET /api/diagnose/supabase`

### 问题 2: 超时错误

**可能原因**:
- 网络延迟高
- 查询执行时间过长
- 服务器响应慢

**解决方案**:
1. 检查查询性能，添加索引
2. 优化查询，减少数据量
3. 考虑使用数据库连接池

### 问题 3: 连接被拒绝

**可能原因**:
- 防火墙阻止连接
- Supabase 服务暂时不可用
- 环境变量配置错误

**解决方案**:
1. 检查防火墙设置
2. 验证环境变量 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. 检查 Supabase Dashboard 确认服务状态

## 进一步优化建议

### 1. 使用连接池（如果可用）

如果 Supabase 提供连接池功能，考虑使用连接池 URL 而不是直接 URL。

### 2. 实现请求去重

对于相同的请求，可以实现请求去重，避免重复的数据库查询。

### 3. 添加缓存层

对于频繁查询的数据，可以添加缓存层（如 Redis），减少数据库查询。

### 4. 监控连接状态

实现连接健康检查，定期检查 Supabase 连接状态，提前发现问题。

### 5. 使用 Supabase Realtime

如果需要实时数据，考虑使用 Supabase Realtime 而不是轮询。

## 诊断工具

### 快速诊断

```bash
# 检查 Supabase 连接状态
curl http://localhost:3000/api/diagnose/supabase
```

### 手动检查

1. **检查环境变量**:
   ```bash
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

2. **测试网络连接**:
   ```bash
   ping <your-supabase-project>.supabase.co
   ```

3. **检查 Supabase Dashboard**:
   - 登录 Supabase Dashboard
   - 查看项目状态
   - 检查 API 使用情况

## 性能监控

建议监控以下指标：
- 连接成功率
- 平均响应时间
- 超时率
- 重试次数

## 联系支持

如果问题持续存在：
1. 检查 Supabase Status 页面: https://status.supabase.com/
2. 查看 Supabase 文档: https://supabase.com/docs
3. 联系 Supabase 支持

