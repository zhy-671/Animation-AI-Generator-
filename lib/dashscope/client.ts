/**
 * 阿里云 DashScope 客户端封装
 * 用于调用 DashScope 的视频生成服务
 */

interface VideoGenerationRequest {
  prompt: string;
  imageUrl?: string; // 图片 URL（图生视频时必填，文生视频时不需要）
  sceneDetail?: string; // 画面描述（可选，用于增强视频生成）
  model?: "wan2.5-i2v-preview" | "wan2.2-i2v-plus" | "wan2.2-i2v-flash" | "wanx2.1-i2v-plus" | "wanx2.1-i2v-turbo" | "wan2.5-t2v-preview"; // 模型名称
  resolution?: "480P" | "720P" | "1080P"; // 分辨率（图生视频使用）
  size?: string; // 分辨率（文生视频使用，格式：宽*高，如 "832*480"）
  duration?: number; // 视频时长（秒）：wan2.5-i2v-preview 支持 5 或 10，其他模型固定为 5
  promptExtend?: boolean; // 是否开启 prompt 智能改写
  audio?: boolean; // 是否添加音频（仅 wan2.5-i2v-preview 和 wan2.5-t2v-preview 支持）
  audioUrl?: string; // 音频文件 URL（仅 wan2.5-i2v-preview 和 wan2.5-t2v-preview 支持）
  negativePrompt?: string; // 反向提示词
  watermark?: boolean; // 是否添加水印
  seed?: number; // 随机数种子
}

interface VideoGenerationResponse {
  taskId: string;
  requestId: string;
}

interface VideoGenerationStatusResponse {
  taskId: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "UNKNOWN";
  requestId?: string; // DashScope API 请求ID
  output?: {
    video_url?: string;
    task_id?: string;
    task_status?: string;
    submit_time?: string;
    scheduled_time?: string;
    end_time?: string;
    orig_prompt?: string;
    actual_prompt?: string;
  };
  usage?: {
    duration?: number;
    video_count?: number;
    SR?: number;
  };
  message?: string;
}

class DashScopeClient {
  private apiKey: string;
  private baseUrl: string;
  private tasksBaseUrl: string; // 任务查询的基础URL

  constructor() {
    this.apiKey = process.env.DASHSCOPE_API_KEY || "";
    // 使用中国版端点（与图片生成和文本生成保持一致）
    this.baseUrl = "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation";
    this.tasksBaseUrl = "https://dashscope.aliyuncs.com/api/v1/tasks"; // 任务查询端点
    
    if (!this.apiKey) {
    }
  }

  /**
   * 提交视频生成任务（异步）
   * 支持图生视频（i2v）和文生视频（t2v）
   */
  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    try {
      const model = request.model || (request.imageUrl ? "wan2.5-i2v-preview" : "wan2.5-t2v-preview");
      const isTextToVideo = model === "wan2.5-t2v-preview" || !request.imageUrl;

      // 构建 input 对象
      const input: any = {};

      if (isTextToVideo) {
        // 文生视频：只需要 prompt
        // 处理 prompt：如果有画面描述，合并到 prompt
        const finalPrompt = request.sceneDetail 
          ? `${request.prompt}\n\n画面描述：${request.sceneDetail}`
          : request.prompt;
        
        // 根据模型限制 prompt 长度
        const maxPromptLength = model === "wan2.5-t2v-preview" ? 2000 : 800;
        input.prompt = finalPrompt.length > maxPromptLength 
          ? finalPrompt.substring(0, maxPromptLength)
          : finalPrompt;

        // 添加反向提示词（如果提供）
        if (request.negativePrompt) {
          const maxNegativeLength = 500;
          input.negative_prompt = request.negativePrompt.length > maxNegativeLength
            ? request.negativePrompt.substring(0, maxNegativeLength)
            : request.negativePrompt;
        }

        // 添加音频 URL（仅 wan2.5-t2v-preview 支持）
        if (model === "wan2.5-t2v-preview" && request.audioUrl) {
          input.audio_url = request.audioUrl;
        }
      } else {
        // 图生视频：需要 img_url 和 prompt
        input.img_url = request.imageUrl;

        // 处理 prompt：如果有画面描述，合并到 prompt
        const finalPrompt = request.sceneDetail 
          ? `${request.prompt}\n\n画面描述：${request.sceneDetail}`
          : request.prompt;
        
        // 根据模型限制 prompt 长度
        const maxPromptLength = model === "wan2.5-i2v-preview" ? 2000 : 800;
        input.prompt = finalPrompt.length > maxPromptLength 
          ? finalPrompt.substring(0, maxPromptLength)
          : finalPrompt;

        // 添加反向提示词（如果提供）
        if (request.negativePrompt) {
          const maxNegativeLength = 500;
          input.negative_prompt = request.negativePrompt.length > maxNegativeLength
            ? request.negativePrompt.substring(0, maxNegativeLength)
            : request.negativePrompt;
        }

        // 添加音频 URL（仅 wan2.5-i2v-preview 支持）
        if (model === "wan2.5-i2v-preview" && request.audioUrl) {
          input.audio_url = request.audioUrl;
        }
      }

      // 构建 parameters 对象
      const parameters: any = {
        prompt_extend: request.promptExtend !== false, // 默认启用
      };

      if (isTextToVideo) {
        // 文生视频：使用 size 参数（格式：宽*高）
        if (request.size) {
          parameters.size = request.size;
        } else {
          // 根据 quality 映射到 size
          // 默认使用 1920*1080（1080P）
          parameters.size = "1920*1080";
        }
      } else {
        // 图生视频：使用 resolution 参数
        if (request.resolution) {
          parameters.resolution = request.resolution;
        } else {
          // 根据模型设置默认分辨率
          if (model === "wan2.5-i2v-preview") {
            parameters.resolution = "1080P";
          } else if (model === "wan2.2-i2v-flash") {
            parameters.resolution = "720P";
          } else {
            parameters.resolution = "1080P";
          }
        }
      }

      // 添加时长（如果支持）
      if (request.duration) {
        parameters.duration = request.duration;
      } else if (model === "wan2.5-i2v-preview" || model === "wan2.5-t2v-preview") {
        parameters.duration = 5; // 默认 5 秒
      }

      // 添加音频参数（wan2.5-i2v-preview 和 wan2.5-t2v-preview 支持）
      if (model === "wan2.5-i2v-preview" || model === "wan2.5-t2v-preview") {
        // audio_url 优先级高于 audio
        if (!request.audioUrl && request.audio !== false) {
          parameters.audio = true; // 默认开启自动配音
        } else if (request.audio === false) {
          parameters.audio = false;
        }
      }

      // 添加水印
      if (request.watermark !== undefined) {
        parameters.watermark = request.watermark;
      }

      // 添加随机数种子
      if (request.seed !== undefined) {
        parameters.seed = request.seed;
      }

      // 构建最终请求体
      const requestBody = {
        model: model,
        input: input,
        parameters: parameters,
      };

      // 打印最终发送给DashScope API的完整请求
      const response = await fetch(`${this.baseUrl}/video-synthesis`, {
        method: "POST",
        headers: {
          "X-DashScope-Async": "enable",
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DashScope API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // DashScope 异步API返回格式：{ output: { task_id: "xxx", task_status: "PENDING" }, request_id: "xxx" }
      const taskId = data.output?.task_id || "";
      
      if (!taskId) {
        throw new Error("No task_id in response: " + JSON.stringify(data));
      }
      
      return {
        taskId,
        requestId: data.request_id || "",
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 查询视频生成任务状态
   * 根据 DashScope 文档，正确的端点是 GET /api/v1/tasks/{task_id}
   */
  async getVideoStatus(taskId: string): Promise<VideoGenerationStatusResponse> {
    try {
      // 使用正确的任务查询端点：/api/v1/tasks/{task_id}
      const endpoint = `${this.tasksBaseUrl}/${taskId}`;
      
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DashScope API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      // DashScope 状态查询返回格式：
      // {
      //   "request_id": "...",
      //   "output": {
      //     "task_id": "...",
      //     "task_status": "SUCCEEDED",
      //     "submit_time": "...",
      //     "scheduled_time": "...",
      //     "end_time": "...",
      //     "orig_prompt": "...",
      //     "video_url": "...",
      //     "actual_prompt": "..."
      //   },
      //   "usage": {
      //     "duration": 10,
      //     "video_count": 1,
      //     "SR": 480
      //   }
      // }
      const taskStatus = (data.output?.task_status || "UNKNOWN").toUpperCase();
      const videoUrl = data.output?.video_url;
      
      return {
        taskId: data.output?.task_id || taskId,
        status: taskStatus as "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "UNKNOWN",
        requestId: data.request_id, // DashScope API 请求ID
        output: {
          video_url: videoUrl,
          task_id: data.output?.task_id,
          task_status: data.output?.task_status,
          submit_time: data.output?.submit_time,
          scheduled_time: data.output?.scheduled_time,
          end_time: data.output?.end_time,
          orig_prompt: data.output?.orig_prompt,
          actual_prompt: data.output?.actual_prompt,
        },
        usage: data.usage,
        message: data.message || data.output?.message || data.error?.message,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 轮询视频生成状态直到完成
   * 根据 DashScope 建议，轮询间隔设置为 15 秒
   */
  async pollVideoStatus(
    taskId: string,
    options: {
      interval?: number; // 轮询间隔（毫秒），默认 15 秒
      maxAttempts?: number; // 最大尝试次数，默认 40 次（10分钟）
    } = {}
  ): Promise<VideoGenerationStatusResponse> {
    const { interval = 15000, maxAttempts = 40 } = options; // 默认每15秒轮询一次，最多40次（10分钟）
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await this.getVideoStatus(taskId);
      
      if (status.status === "SUCCEEDED") {
        return status;
      }
      
      if (status.status === "FAILED" || status.status === "CANCELED") {
        throw new Error(`Video generation ${status.status.toLowerCase()}: ${status.message || "Unknown error"}`);
      }
      
      if (status.status === "UNKNOWN") {
        throw new Error(`Video generation task not found or status unknown: ${taskId}`);
      }
      
      // 如果还在处理中（PENDING 或 RUNNING），等待后继续轮询
      if (status.status === "PENDING" || status.status === "RUNNING") {
        await new Promise(resolve => setTimeout(resolve, interval));
        continue;
      }
      
      // 其他未知状态，等待后重试
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error("Video generation timeout after maximum attempts");
  }
}

export const dashScopeClient = new DashScopeClient();
export type { VideoGenerationRequest, VideoGenerationResponse, VideoGenerationStatusResponse };

