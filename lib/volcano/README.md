# 火山引擎配置说明

## 环境变量

在 `.env.local` 文件中添加以下配置：

```env
# 火山引擎 API 配置
VOLCANO_API_KEY=your_volcano_api_key_here
# 或者使用 ARK_API_KEY（两者都可以）
ARK_API_KEY=your_volcano_api_key_here

# API 基础 URL（可选，默认值已设置）
VOLCANO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

# 故事生成模型端点（重要：需要替换为实际的端点ID）
# 火山引擎使用端点ID格式，例如：ep-20241220123456-abcde
VOLCANO_STORY_MODEL=ep-xxxxx-xxxxx

# 图片生成模型（可选，默认使用 doubao-seedream-4.0）
VOLCANO_IMAGE_MODEL=doubao-seedream-4.0
```

## 获取 API Key 和端点ID

1. 登录火山引擎控制台：https://console.volcengine.com/
2. 进入 **AI 服务** > **模型推理** > **推理接入**
3. 创建或选择一个推理端点
4. 获取：
   - **API Key**: 在端点详情中查看
   - **端点ID**: 格式为 `ep-xxxxx-xxxxx`，这是模型名称

## 重要提示

⚠️ **端点ID格式**: 火山引擎使用端点ID（Endpoint ID）而不是模型名称。端点ID格式通常为 `ep-` 开头的字符串。

例如：
- ✅ 正确：`ep-20241220123456-abcde`
- ❌ 错误：`doubao-seed-1.6`

## API 端点说明

- **故事生成**: 使用您创建的推理端点ID（`VOLCANO_STORY_MODEL`）
- **图片生成**: 使用 `doubao-seedream-4.0` 或您配置的其他图片生成模型

## 常见问题

### 1. 404 错误：模型不存在
- 检查 `VOLCANO_STORY_MODEL` 是否设置为正确的端点ID
- 确认端点ID格式为 `ep-xxxxx-xxxxx`
- 确认您有该端点的访问权限

### 2. 401 错误：认证失败
- 检查 `VOLCANO_API_KEY` 是否正确
- 确认 API Key 有访问该端点的权限

### 3. 如何找到端点ID？
- 在火山引擎控制台的推理接入页面
- 点击您创建的端点
- 在端点详情中可以看到端点ID（Endpoint ID）

