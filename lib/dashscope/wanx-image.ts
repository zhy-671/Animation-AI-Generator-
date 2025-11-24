/**
 * 阿里云 DashScope 通义万相图像生成客户端封装
 * 用于调用通义万相模型生成图像（异步API）
 */

interface ImageGenerationRequest {
  prompt: string; // 图像生成提示词（英文）
  style?: string; // 动画风格（可选，用于增强提示词）
  size?: string; // 图像尺寸，默认 "1280*1280"
  n?: number; // 生成数量，默认 1
  negativePrompt?: string; // 反向提示词
  promptExtend?: boolean; // 是否开启prompt智能改写
  watermark?: boolean; // 是否添加水印
  seed?: number; // 随机数种子
  refImg?: string; // 参考图片URL（用于角色一致性）
}

interface ImageToImageRequest {
  prompt: string; // 图像生成提示词（英文）
  images: string[]; // 参考图片URL数组（最多2张）
  n?: number; // 生成数量，默认 1
  size?: string; // 图像尺寸，默认 "1024*1024"
}

interface ImageGenerationResponse {
  images: string[]; // 图片 URL 数组
  requestId?: string;
  taskId?: string; // 任务ID（异步模式）
}

interface ImageTaskStatus {
  taskId: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "UNKNOWN";
  requestId?: string;
  images?: string[]; // 成功时的图片URL数组
  message?: string;
}

class WanXImageClient {
  private apiKey: string;
  private baseUrl: string;
  private image2ImageBaseUrl: string; // 图生图端点
  private model: string;

  private tasksBaseUrl: string; // 任务查询的基础URL

  constructor() {
    this.apiKey = process.env.DASHSCOPE_API_KEY || "";
    this.baseUrl = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image";
    this.image2ImageBaseUrl = "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis";
    this.tasksBaseUrl = "https://dashscope.aliyuncs.com/api/v1/tasks"; // 任务查询端点
    this.model = process.env.WANX_IMAGE_MODEL || "wan2.5-t2i-preview"; // 默认使用 wan2.5-t2i-preview
    
    if (!this.apiKey) {
    }
  }

  /**
   * 提交图像生成任务（异步模式）
   */
  async submitImageTask(request: ImageGenerationRequest): Promise<{ taskId: string; requestId: string }> {
    try {
      // 风格增强提示词（可选）
      const styleEnhancements: Record<string, string> = {
        "2d": "2D animation style, flat animation effect",
        "3d": "3D animation style, three-dimensional effect",
        "anime": "Japanese anime style, anime aesthetic",
        "clay": "clay animation style, clay material effect",
        "comic": "American comic style, comic book aesthetic",
        "cartoon": "cartoon animation style, cartoon effect",
        "cyberpunk": "cyberpunk style, futuristic sci-fi",
      };
      
      let finalPrompt = request.prompt;
      if (request.style && styleEnhancements[request.style]) {
        // 如果提示词中不包含风格描述，则添加
        if (!finalPrompt.toLowerCase().includes(request.style.toLowerCase())) {
          finalPrompt = `${finalPrompt}, ${styleEnhancements[request.style]}`;
        }
      }

      const requestBody: any = {
        model: this.model,
        input: {
          prompt: finalPrompt,
        },
        parameters: {
          size: request.size || "1280*1280",
          n: request.n || 1,
        },
      };

      // 添加参考图片（ref）
      if (request.refImg) {
        requestBody.input.ref = request.refImg;
      }

      // 添加可选参数
      if (request.negativePrompt) {
        requestBody.input.negative_prompt = request.negativePrompt;
      }
      if (request.promptExtend !== undefined) {
        requestBody.parameters.prompt_extend = request.promptExtend;
      }
      if (request.watermark !== undefined) {
        requestBody.parameters.watermark = request.watermark;
      }
      if (request.seed !== undefined) {
        requestBody.parameters.seed = request.seed;
      }

      const response = await fetch(`${this.baseUrl}/image-synthesis`, {
        method: "POST",
        headers: {
          "X-DashScope-Async": "enable", // 异步模式必需
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WanX Image API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // DashScope 异步API返回格式：
      // {
      //   "output": {
      //     "task_status": "PENDING",
      //     "task_id": "0385dc79-5ff8-4d82-bcb6-xxxxxx"
      //   },
      //   "request_id": "4909100c-7b5a-9f92-bfe5-xxxxxx"
      // }
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
   * 提交图生图任务（异步模式，专门用于分镜图生成）
   * 使用独立的图生图端点，不与文生图混合
   */
  async submitImageToImageTask(request: ImageToImageRequest): Promise<{ taskId: string; requestId: string }> {
    try {
      if (!this.apiKey) {
        throw new Error("DASHSCOPE_API_KEY is not set");
      }

      if (!request.images || request.images.length === 0) {
        throw new Error("At least one reference image is required for image-to-image generation");
      }

      // 限制最多2张参考图
      const refImages = request.images.slice(0, 2);

      const requestBody: any = {
        model: "wan2.5-i2i-preview",
        input: {
          prompt: request.prompt,
          images: refImages,
        },
        parameters: {
          size: request.size || "1024*1024",
          n: request.n || 1,
        },
      };

      const response = await fetch(this.image2ImageBaseUrl, {
        method: "POST",
        headers: {
          "X-DashScope-Async": "enable", // 异步模式必需
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DashScope API error: status: ${response.status}, error: ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.output || !result.output.task_id) {
        throw new Error(`Invalid response from DashScope API: ${JSON.stringify(result)}`);
      }

      return {
        taskId: result.output.task_id,
        requestId: result.request_id || "",
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 查询图像生成任务状态
   */
  async getImageTaskStatus(taskId: string): Promise<ImageTaskStatus> {
    try {
      const response = await fetch(`${this.tasksBaseUrl}/${taskId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WanX Image status API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // DashScope 状态查询返回格式：
      // {
      //   "request_id": "...",
      //   "output": {
      //     "task_id": "...",
      //     "task_status": "SUCCEEDED",
      //     "results": [
      //       {
      //         "url": "https://..."
      //       }
      //     ]
      //   }
      // }
      const taskStatus = (data.output?.task_status || "UNKNOWN").toUpperCase();
      const images = data.output?.results?.map((result: any) => result.url) || [];

      return {
        taskId: data.output?.task_id || taskId,
        status: taskStatus as "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "UNKNOWN",
        requestId: data.request_id,
        images: images.length > 0 ? images : undefined,
        message: data.message || data.output?.message || data.error?.message,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 轮询图像生成状态直到完成（优化轮询策略）
   */
  async pollImageTaskStatus(
    taskId: string,
    options: {
      initialInterval?: number; // 初始轮询间隔（毫秒），默认 3 秒
      maxInterval?: number; // 最大轮询间隔（毫秒），默认 10 秒
      initialPeriod?: number; // 初始快速轮询周期（毫秒），默认 30 秒
      timeout?: number; // 总超时时间（毫秒），默认 2 分钟
    } = {}
  ): Promise<ImageTaskStatus> {
    const {
      initialInterval = 3000, // 前30秒每3秒查询一次
      maxInterval = 10000, // 之后最多每10秒查询一次
      initialPeriod = 30000, // 初始快速轮询周期30秒
      timeout = 120000, // 总超时时间2分钟
    } = options;
    
    const startTime = Date.now();
    let currentInterval = initialInterval;
    let attemptCount = 0;
    
    while (true) {
      // 检查是否超时
      const elapsed = Date.now() - startTime;
      if (elapsed >= timeout) {
        throw new Error(`Image generation timeout after ${timeout / 1000} seconds`);
      }
      
      // 查询任务状态
      const status = await this.getImageTaskStatus(taskId);
      attemptCount++;
      
      if (status.status === "SUCCEEDED") {
        return status;
      }
      
      if (status.status === "FAILED" || status.status === "CANCELED") {
        throw new Error(`Image generation ${status.status.toLowerCase()}: ${status.message || "Unknown error"}`);
      }
      
      if (status.status === "UNKNOWN") {
        throw new Error(`Image generation task not found or status unknown: ${taskId}`);
      }
      
      // 如果还在处理中（PENDING 或 RUNNING），根据时间调整轮询间隔
      if (status.status === "PENDING" || status.status === "RUNNING") {
        // 如果还在初始快速轮询周期内，使用初始间隔
        if (elapsed < initialPeriod) {
          currentInterval = initialInterval;
        } else {
          // 超过初始周期后，逐渐增加间隔，但不超过最大值
          // 每30秒增加一次间隔，直到达到最大值
          const periodsAfterInitial = Math.floor((elapsed - initialPeriod) / 30000);
          currentInterval = Math.min(
            initialInterval + periodsAfterInitial * 2000, // 每次增加2秒
            maxInterval
          );
        }
        
        // 等待后继续轮询
        await new Promise(resolve => setTimeout(resolve, currentInterval));
        continue;
      }
      
      // 其他未知状态，使用当前间隔等待后重试
      await new Promise(resolve => setTimeout(resolve, currentInterval));
    }
  }

  /**
   * 调用通义万相生成图像（异步模式，完整流程）
   */
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    // 提交任务
    const { taskId, requestId } = await this.submitImageTask(request);
    
    // 轮询状态直到完成
    const status = await this.pollImageTaskStatus(taskId);
    
    if (!status.images || status.images.length === 0) {
      throw new Error("No images generated");
    }

    return {
      images: status.images,
      requestId: status.requestId || requestId,
      taskId: status.taskId,
    };
  }

  /**
   * 批量生成图像（带延迟以避免速率限制）
   */
  async generateImages(requests: ImageGenerationRequest[]): Promise<ImageGenerationResponse> {
    const delayBetweenRequests = 1000; // 每个请求之间延迟1秒
    const allImages: string[] = [];
    
    // 顺序处理请求，避免同时发送太多请求导致速率限制
    for (let i = 0; i < requests.length; i++) {
      try {
        // 如果不是第一个请求，添加延迟
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
        }
        
        const result = await this.generateImage(requests[i]);
        allImages.push(...result.images);
      } catch (error) {
        // 如果单个图像生成失败，继续处理下一个，但记录错误
        // 可以选择跳过或抛出错误，这里选择跳过
        // throw error; // 如果需要严格模式，取消注释这行
      }
    }
    
    if (allImages.length === 0) {
      throw new Error("Failed to generate any images");
    }
    
    return {
      images: allImages,
    };
  }
}

export const wanXImageClient = new WanXImageClient();
export type { ImageGenerationRequest, ImageGenerationResponse, ImageToImageRequest };

