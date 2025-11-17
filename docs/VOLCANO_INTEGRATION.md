# 火山引擎分镜生成功能集成

## 功能概述

已成功集成火山引擎的分镜生成功能，实现了以下流程：

1. **故事创作**: 调用 `doubao-seed-1.6` 模型，根据用户提示词和参考图生成故事
2. **分镜拆解**: 自动将故事拆分为 5-10 个分镜
3. **文案和画面描述生成**: 为每个分镜生成对应的文案和画面描述
4. **图片生成**: 调用 `doubao-seedream-4.0` 模型为每个分镜生成配图
5. **封面生成**: 自动生成故事书封面

## 文件结构

```
lib/volcano/
  ├── client.ts          # 火山引擎客户端封装
  └── README.md          # 配置说明

app/api/scenes/
  └── generate/
      └── route.ts       # 分镜生成 API 路由

components/generator/
  └── animation-generator-form.tsx  # 更新了前端组件
```

## 使用流程

1. 用户在 Text to Video 模式下输入提示词
2. 可选：上传参考图
3. 选择读者群（儿童/青少年/成人/全年龄）
4. 点击"生成分镜"按钮
5. 系统调用火山引擎 API 生成故事和分镜
6. 显示生成的分镜图片和文案

## API 端点

### POST /api/scenes/generate

**请求参数:**
- `prompt` (string, required): 用户输入的提示词
- `referenceImage` (File, optional): 参考图片
- `readerGroup` (string, optional): 读者群，默认为"全年龄"

**响应格式:**
```json
{
  "success": true,
  "data": {
    "title": "故事书名",
    "summary": "故事总结",
    "scenes": [
      {
        "text": "分镜文案",
        "imageUrl": "图片URL",
        "sceneNumber": 1
      }
    ],
    "coverImageUrl": "封面图片URL"
  }
}
```

## 环境变量配置

在 `.env.local` 中添加：

```env
VOLCANO_API_KEY=your_api_key_here
VOLCANO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

## 注意事项

1. **API 格式**: 需要根据火山引擎的实际 API 文档调整请求格式
2. **图片上传**: 图片上传到火山存储的功能需要单独实现
3. **数据库存储**: 生成的故事内容可以保存到数据库（待实现）
4. **错误处理**: 已添加基本的错误处理，但可能需要根据实际 API 响应调整

## 待完成功能

- [ ] 实现图片上传到火山存储
- [ ] 创建数据库表存储生成的故事书内容
- [ ] 添加用户故事书管理功能
- [ ] 优化错误提示和加载状态

