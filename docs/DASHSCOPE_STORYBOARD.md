# DashScope 分镜生成配置说明

## 概述

创作页面的分镜生成功能已更新为使用：
- **通义千问（Qwen2）**：生成结构化的动漫分镜JSON
- **通义万相（WanX）**：根据分镜描述生成对应的图像

## 环境变量配置

在 `.env.local` 文件中添加以下配置：

```env
# 阿里云 DashScope API Key（必需）
DASHSCOPE_API_KEY=sk-xxxxx

# 通义千问模型（可选，默认使用 qwen-plus）
# 可选值：qwen-plus, qwen-max, qwen-turbo
QWEN_MODEL=qwen-plus

# 通义万相图像生成模型（可选，默认使用 wanx-v1）
# 可选值：wanx-v1, wan2.2-t2i-flash
WANX_IMAGE_MODEL=wanx-v1
```

## API 端点

### 通义千问（Qwen2）
- **端点**: `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation`
- **用途**: 根据用户输入的主题生成结构化的分镜JSON

### 通义万相（WanX）
- **端点**: `https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/generation`
- **用途**: 根据分镜中的 `image_prompt` 生成对应的图像

## 分镜JSON格式

通义千问生成的分镜JSON格式如下：

```json
{
  "title": "动漫标题",
  "summary": "故事概要，50字以内",
  "style": "画风风格描述（如 赛博朋克、二次元、宫崎骏风格等）",
  "scenes": [
    {
      "scene_id": 1,
      "scene_title": "场景标题",
      "description": "这一镜头的详细画面描述，包括人物、动作、环境、光线等。",
      "camera": "镜头语言（例如：远景 / 推镜 / 鸟瞰 / 特写）",
      "dialogue": ["人物对白1", "人物对白2"],
      "image_prompt": "给通义万相生成图像的提示词（英文，描述风格、动作、光线、环境）",
      "duration": "该镜头建议的持续时间（秒）"
    }
  ]
}
```

## 生成流程

1. **用户输入提示词**：用户在创作页面输入主题或故事描述
2. **调用通义千问**：使用 Qwen2 生成结构化的分镜JSON（5-8个场景）
3. **提取图像提示词**：从每个场景的 `image_prompt` 字段提取图像生成提示词
4. **批量生成图像**：使用通义万相为每个场景生成对应的图像
5. **上传到存储**：将生成的图像上传到火山引擎TOS存储
6. **返回结果**：组装完整的分镜数据（包含图像URL）返回给前端

## API 路由

### POST /api/scenes/generate

**请求参数（FormData）:**
- `prompt` (string, 必需): 用户输入的提示词
- `referenceImage` (File, 可选): 参考图片
- `readerGroup` (string, 可选): 读者群组，默认 "全年龄"
- `style` (string, 可选): 动画风格，默认 "2d"

**响应格式:**
```json
{
  "success": true,
  "data": {
    "title": "动漫标题",
    "summary": "故事概要",
    "scenes": [
      {
        "text": "画面描述",
        "sceneDetail": "画面描述",
        "imageUrl": "https://...",
        "sceneNumber": 1,
        "sceneTitle": "场景标题",
        "camera": "镜头语言",
        "dialogue": ["对白1", "对白2"],
        "duration": "持续时间"
      }
    ],
    "fullJsonData": {
      "title": "动漫标题",
      "summary": "故事概要",
      "style": "画风风格",
      "scenes": [
        {
          "scene_id": 1,
          "scene_title": "场景标题",
          "description": "画面描述",
          "camera": "镜头语言",
          "dialogue": ["对白1", "对白2"],
          "image_prompt": "图像提示词",
          "duration": "持续时间",
          "imageUrl": "https://..."
        }
      ],
      "originalPrompt": "用户输入的提示词",
      "readerGroup": "全年龄",
      "style": "2d"
    }
  }
}
```

## 支持的动画风格

- `2d`: 2D动画风格
- `3d`: 3D动画风格
- `anime`: 日本二次元风格
- `clay`: 粘土动画风格
- `comic`: 美式漫画风格
- `cartoon`: 动漫风格
- `cyberpunk`: 赛博朋克风格

## 注意事项

1. **API Key**: 确保 `DASHSCOPE_API_KEY` 已正确配置
2. **模型选择**: 
   - Qwen2: `qwen-plus` 平衡性能和成本，`qwen-max` 效果更好但更贵
   - WanX: `wanx-v1` 通用模型，`wan2.2-t2i-flash` 速度更快
3. **场景数量**: 分镜场景数量控制在 5-8 个
4. **图像提示词**: `image_prompt` 必须是英文，用于通义万相生成图像
5. **存储**: 生成的图像会自动上传到火山引擎TOS存储

## 错误处理

如果API调用失败，会返回错误信息：
```json
{
  "error": "错误描述"
}
```

常见错误：
- `DASHSCOPE_API_KEY is not set`: API Key未配置
- `No JSON found in Qwen2 response`: Qwen2返回格式不正确
- `Invalid storyboard data format`: 分镜数据格式验证失败
- `No images generated`: 图像生成失败

## 相关文件

- `lib/dashscope/qwen2.ts`: 通义千问客户端
- `lib/dashscope/wanx-image.ts`: 通义万相图像生成客户端
- `app/api/scenes/generate/route.ts`: 分镜生成API路由
- `lib/volcano/storage.ts`: 火山引擎TOS存储客户端

