# DashScope 视频生成配置说明

## 环境变量

在 `.env.local` 文件中添加以下配置：

```env
# 阿里云 DashScope API Key
DASHSCOPE_API_KEY=sk-d7fb454be3b84aadbbf1c0e63136ece3
```

## API 说明

### 视频生成流程

1. **提交任务**: 调用 `/api/video/generate` 提交视频生成任务
   - 使用异步模式（`X-DashScope-Async: enable`）
   - 返回 `taskId` 用于查询状态

2. **查询状态**: 调用 `/api/video/status?taskId=xxx` 查询任务状态
   - 状态：`PENDING` → `RUNNING` → `SUCCEEDED` / `FAILED`
   - 成功后返回视频 URL

3. **轮询机制**: 前端自动轮询状态直到完成
   - 默认每 3 秒查询一次
   - 最多轮询 60 次（约 3 分钟）

## API 端点

### POST /api/video/generate

**请求体:**
```json
{
  "prompt": "一只猫在草地上奔跑",
  "imageUrl": "https://example.com/image.png",
  "resolution": "1080P",
  "promptExtend": true
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "taskId": "xxx",
    "requestId": "xxx"
  }
}
```

### GET /api/video/status?taskId=xxx

**响应:**
```json
{
  "success": true,
  "data": {
    "taskId": "xxx",
    "status": "SUCCEEDED",
    "output": {
      "video_url": "https://example.com/video.mp4"
    }
  }
}
```

## 使用说明

1. 用户上传或生成图片
2. 输入视频描述（prompt）
3. 点击"生成video"按钮
4. 系统自动提交任务并轮询状态
5. 完成后显示视频

## 注意事项

- 视频生成是异步的，需要轮询状态
- 生成时间取决于视频长度和复杂度
- 建议设置合理的超时时间
- API Key 需要妥善保管，不要提交到代码仓库

