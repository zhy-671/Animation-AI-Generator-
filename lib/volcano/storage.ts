/**
 * 火山引擎 TOS（对象存储）客户端封装
 * 使用官方 @volcengine/tos-sdk
 */

import { TosClient as VolcTOSClient } from '@volcengine/tos-sdk';

interface TOSConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  endpoint: string;
}

class TOSClient {
  private client: VolcTOSClient;
  private config: TOSConfig;

  constructor() {
    const accessKeyId = process.env.VOLCANO_TOS_ACCESS_KEY_ID || "";
    const secretAccessKey = process.env.VOLCANO_TOS_SECRET_ACCESS_KEY || "";
    const region = process.env.VOLCANO_TOS_REGION || "cn-hongkong";
    const endpoint = process.env.VOLCANO_TOS_ENDPOINT || `tos-${region}.volces.com`;

    if (!accessKeyId || !secretAccessKey) {
      console.warn("VOLCANO_TOS_ACCESS_KEY_ID and VOLCANO_TOS_SECRET_ACCESS_KEY are not set");
    }

    this.config = {
      accessKeyId,
      secretAccessKey,
      region,
      endpoint: endpoint.replace(/^https?:\/\//, ''), // 移除协议前缀，只保留域名
    };

    // 初始化官方 TOS SDK 客户端
    this.client = new VolcTOSClient({
      accessKeyId: this.config.accessKeyId,
      accessKeySecret: this.config.secretAccessKey,
      region: this.config.region,
      endpoint: this.config.endpoint,
    });
  }

  /**
   * 上传文件到 TOS（使用官方SDK）
   */
  async uploadFile(
    bucket: string,
    key: string,
    file: Buffer | ArrayBuffer,
    contentType: string
  ): Promise<string> {
    try {
      // 将 ArrayBuffer 转换为 Buffer
      const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);

      // 使用官方SDK上传文件
      await this.client.putObject({
        bucket: bucket,
        key: key,
        body: buffer,
        contentType: contentType,
      });

      // 返回公开访问 URL
      return `https://${bucket}.${this.config.endpoint}/${key}`;
    } catch (error) {
      console.error("Error uploading to TOS:", error);
      throw error;
    }
  }

  /**
   * 上传图片到配置的 bucket
   */
  async uploadImage(file: Buffer | ArrayBuffer, filename: string): Promise<string> {
    const key = `images/${filename}`;
    // 根据文件扩展名确定Content-Type
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/jpeg';
    const bucket = process.env.VOLC_TOS_BUCKET || "storybooks";
    return this.uploadFile(bucket, key, file, contentType);
  }

  /**
   * 上传视频到配置的 bucket
   */
  async uploadVideo(file: Buffer | ArrayBuffer, filename: string): Promise<string> {
    const key = `videos/${filename}`;
    const bucket = process.env.VOLC_TOS_STORYVIDEO_BUCKET || "storyvideo";
    return this.uploadFile(bucket, key, file, "video/mp4");
  }

  /**
   * 从 URL 下载并上传图片
   */
  async uploadImageFromUrl(imageUrl: string, filename: string): Promise<string> {
    console.log('=== TOSClient.uploadImageFromUrl ===');
    console.log('imageUrl:', imageUrl);
    console.log('filename:', filename);
    
    try {
      console.log('开始fetch图片URL...');
      const response = await fetch(imageUrl);
      console.log('fetch响应状态:', response.status, response.statusText);
      console.log('响应头 Content-Type:', response.headers.get('content-type'));
      console.log('响应头 Content-Length:', response.headers.get('content-length'));
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '无法读取错误响应');
        console.error('fetch失败:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 200),
        });
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
      }
      
      console.log('开始读取响应为ArrayBuffer...');
      const buffer = await response.arrayBuffer();
      console.log('ArrayBuffer大小:', buffer.byteLength, 'bytes');
      
      console.log('开始上传到TOS...');
      const uploadedUrl = await this.uploadImage(buffer, filename);
      console.log('上传成功，返回URL:', uploadedUrl);
      
      return uploadedUrl;
    } catch (error) {
      console.error('uploadImageFromUrl错误:', error);
      if (error instanceof Error) {
        console.error('错误消息:', error.message);
        console.error('错误堆栈:', error.stack);
      }
      throw error;
    }
  }

  /**
   * 从 URL 下载并上传视频
   */
  async uploadVideoFromUrl(videoUrl: string, filename: string): Promise<string> {
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return this.uploadVideo(buffer, filename);
  }

  /**
   * 生成预签名 URL（用于外部服务访问，如 DashScope API）
   * @param bucket 存储桶名称
   * @param key 对象键
   * @param expiresIn 过期时间（秒），默认 3600 秒（1小时）
   * @returns 预签名 URL
   */
  async getPresignedUrl(
    bucket: string,
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      // 使用 TOS SDK 生成预签名 URL
      // 注意：TOS SDK 的 getPreSignedUrl 是同步方法，返回字符串
      const presignedUrl = this.client.getPreSignedUrl({
        method: 'GET',
        bucket: bucket,
        key: key,
        expires: expiresIn, // TOS SDK 使用 expires 参数
      });
      
      return presignedUrl;
    } catch (error) {
      console.error("Error generating presigned URL:", error);
      // 如果生成预签名 URL 失败，返回公开访问 URL（如果 bucket 是公开的）
      return `https://${bucket}.${this.config.endpoint}/${key}`;
    }
  }

  /**
   * 获取图片的预签名 URL（用于视频生成）
   * @param imageUrl TOS 图片 URL（完整 URL 或 key）
   * @param expiresIn 过期时间（秒），默认 7 天（604800 秒）
   * @returns 预签名 URL
   */
  async getImagePresignedUrl(
    imageUrl: string,
    expiresIn: number = 7 * 24 * 3600 // 默认 7 天
  ): Promise<string> {
    try {
      // 如果 imageUrl 是完整 URL，尝试从 URL 中提取 bucket 和 key
      let bucket: string;
      let key: string;
      
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        try {
          // 从完整 URL 中提取 bucket 和 key
          // TOS URL 格式: https://bucket.endpoint/key 或 https://bucket.region.volces.com/key
          const url = new URL(imageUrl);
          const hostname = url.hostname;
          
          // 尝试从 hostname 中提取 bucket（格式：bucket.endpoint 或 bucket.region.volces.com）
          const hostParts = hostname.split('.');
          if (hostParts.length > 0 && (hostname.includes('tos-') || hostname.includes('volces.com'))) {
            // 第一个部分是 bucket
            bucket = hostParts[0];
            // pathname 的第一部分之后是 key
            const pathname = url.pathname;
            key = pathname.startsWith('/') ? pathname.substring(1) : pathname;
          } else {
            // 如果无法从 hostname 提取，使用环境变量中的 bucket
            bucket = process.env.VOLC_TOS_BUCKET || process.env.VOLCANO_TOS_BUCKET || "storybooks";
            const pathname = url.pathname;
            key = pathname.startsWith('/') ? pathname.substring(1) : pathname;
          }
        } catch (error) {
          // 如果 URL 解析失败，使用环境变量中的 bucket
          bucket = process.env.VOLC_TOS_BUCKET || process.env.VOLCANO_TOS_BUCKET || "storybooks";
          // 尝试从 URL 中提取 key
          const match = imageUrl.match(/\/images\/(.+)/);
          key = match ? `images/${match[1]}` : imageUrl.replace(/^https?:\/\/[^\/]+\//, '');
        }
      } else {
        // 如果已经是 key，使用环境变量中的 bucket
        bucket = process.env.VOLC_TOS_BUCKET || process.env.VOLCANO_TOS_BUCKET || "storybooks";
        key = imageUrl;
      }
      
      console.log(`Generating presigned URL for bucket: ${bucket}, key: ${key}`);
      
      return this.getPresignedUrl(bucket, key, expiresIn);
    } catch (error) {
      console.error("Error generating presigned URL:", error);
      // 如果生成预签名 URL 失败，返回原始 URL
      console.warn("Failed to generate presigned URL, returning original URL:", imageUrl);
      return imageUrl;
    }
  }
}

export const tosClient = new TOSClient();
