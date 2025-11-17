# 火山引擎 TOS（对象存储）配置说明

## 环境变量配置

在 `.env.local` 文件中添加以下配置：

```env
# 火山引擎 TOS（对象存储）配置
VOLC_TOS_ACCESS_KEY_ID=your_access_key_id
VOLC_TOS_SECRET_ACCESS_KEY=your_secret_access_key
VOLC_TOS_REGION=cn-hongkong  # 区域，如 cn-hongkong, cn-beijing 等
VOLC_TOS_ENDPOINT=https://tos-cn-hongkong.volces.com  # TOS 端点
```

## 如何获取 TOS 凭证

1. 登录 [火山引擎控制台](https://console.volcengine.com/)
2. 进入 **对象存储 TOS** 服务
3. 创建存储桶：
   - `storybooks` - 用于存储图片
   - `storyvideo` - 用于存储视频
4. 在 **访问控制** > **密钥管理** 中创建 Access Key
5. 获取：
   - **Access Key ID** → `VOLC_TOS_ACCESS_KEY_ID`
   - **Secret Access Key** → `VOLC_TOS_SECRET_ACCESS_KEY`

## 存储桶配置

- **图片存储桶**: `storybooks`
  - 路径格式: `images/{user_id}/{timestamp}-{random}.{ext}`
  
- **视频存储桶**: `storyvideo`
  - 路径格式: `videos/{user_id}/{timestamp}-{random}.mp4`

## 注意事项

⚠️ **签名算法**: 当前实现使用了简化的签名方式。在生产环境中，您需要：

1. **使用官方 SDK**（如果有）：
   ```bash
   npm install @volcengine/tos-nodejs  # 如果官方提供了 SDK
   ```

2. **实现完整的签名算法**：
   - TOS 使用与 AWS S3 兼容的签名算法（AWS Signature Version 4）
   - 需要实现完整的签名逻辑以确保安全性

3. **使用预签名 URL**：
   - 在服务端生成预签名 URL
   - 客户端直接使用预签名 URL 上传

## API 使用

### 上传图片
```typescript
import { tosClient } from '@/lib/volcano/storage';

// 从文件上传
const url = await tosClient.uploadImage(fileBuffer, 'filename.jpg');

// 从 URL 上传
const url = await tosClient.uploadImageFromUrl('https://example.com/image.jpg', 'filename.jpg');
```

### 上传视频
```typescript
import { tosClient } from '@/lib/volcano/storage';

// 从文件上传
const url = await tosClient.uploadVideo(videoBuffer, 'filename.mp4');

// 从 URL 上传
const url = await tosClient.uploadVideoFromUrl('https://example.com/video.mp4', 'filename.mp4');
```

## 安全建议

1. **不要将 Access Key 提交到代码仓库**
2. **使用环境变量存储凭证**
3. **为不同的存储桶设置不同的访问权限**
4. **定期轮换 Access Key**
5. **使用 IAM 策略限制访问范围**

