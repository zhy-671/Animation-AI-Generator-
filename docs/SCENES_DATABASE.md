# 分镜和视频数据库管理

## 数据库表结构

### 1. anim_scenes（分镜表）
存储用户创建的分镜主记录：
- `id`: UUID 主键
- `user_id`: 用户ID（外键）
- `title`: 故事标题
- `summary`: 故事总结
- `cover_image_url`: 封面图片URL
- `created_at`, `updated_at`: 时间戳
- `metadata`: JSONB 扩展字段

### 2. anim_scene_items（分镜详情表）
存储每个分镜的具体内容：
- `id`: UUID 主键
- `scene_id`: 分镜ID（外键）
- `scene_number`: 分镜序号
- `text`: 分镜文案
- `image_url`: 图片URL
- `video_url`: 视频URL
- `created_at`, `updated_at`: 时间戳
- `metadata`: JSONB 扩展字段

### 3. anim_videos（视频表）
存储生成的视频记录：
- `id`: UUID 主键
- `user_id`: 用户ID（外键）
- `scene_item_id`: 分镜项ID（外键，可选）
- `video_url`: 视频URL
- `prompt`: 生成提示词
- `image_url`: 源图片URL
- `resolution`: 分辨率
- `task_id`: DashScope 任务ID
- `status`: 状态（pending/processing/completed/failed）
- `created_at`, `updated_at`: 时间戳
- `metadata`: JSONB 扩展字段

## API 端点

### 分镜管理

- `POST /api/scenes` - 创建分镜
- `GET /api/scenes` - 获取用户的所有分镜
- `GET /api/scenes?sceneId=xxx` - 获取单个分镜详情
- `DELETE /api/scenes?sceneId=xxx` - 删除分镜

### 分镜项管理

- `PATCH /api/scenes/items/:itemId` - 更新分镜项（图片、文本）

### 视频管理

- `POST /api/scenes/videos` - 创建或更新视频
- `DELETE /api/scenes/videos?sceneItemId=xxx` - 删除视频

### 图片上传

- `POST /api/scenes/upload-image` - 上传图片到云存储

## 功能流程

### 1. 生成分镜
1. 用户点击"生成分镜"
2. 调用火山引擎 API 生成故事和图片
3. 保存到数据库：
   - 创建 `anim_scenes` 记录
   - 创建多个 `anim_scene_items` 记录
4. 更新前端状态，显示分镜预览

### 2. 删除图片
1. 用户点击删除图片
2. 更新本地状态（清空 imageUrl）
3. 调用 API 更新数据库（设置 image_url 为 null）

### 3. 上传新图片
1. 用户选择图片文件
2. 上传到 Supabase Storage
3. 获取图片 URL
4. 更新本地状态
5. 调用 API 更新数据库（更新 image_url）

### 4. 生成视频
1. 用户点击"生成video"
2. 提交 DashScope 视频生成任务
3. 轮询任务状态
4. 完成后保存到数据库：
   - 创建或更新 `anim_videos` 记录
   - 更新 `anim_scene_items` 的 video_url

### 5. 删除视频
1. 用户点击删除视频
2. 更新本地状态（清空 videoUrl）
3. 调用 API 删除数据库记录：
   - 删除 `anim_videos` 记录
   - 清空 `anim_scene_items` 的 video_url

### 6. 重新生成
- 视频：调用 `createOrUpdateVideo`，如果记录存在则更新，不存在则创建
- 图片：直接更新 `image_url` 字段

## 安全策略（RLS）

所有表都启用了 Row Level Security：
- 用户只能访问自己的数据
- 分镜项的操作需要验证所属分镜的用户ID
- 所有操作都需要用户认证

## 注意事项

1. **云存储配置**：需要在 Supabase 中创建 `scenes` bucket
2. **图片上传**：目前使用 Supabase Storage，可以替换为其他云存储服务
3. **数据一致性**：删除操作会级联删除相关记录
4. **错误处理**：所有数据库操作都有错误处理，不会阻止用户继续使用

