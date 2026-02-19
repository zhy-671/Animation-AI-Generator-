import { NextRequest, NextResponse } from "next/server";
import { tosClient } from "@/lib/volcano/storage";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { pipeline } from "stream";
import { randomUUID } from "crypto";
import FormData from "form-data";

const streamPipeline = promisify(pipeline);

const LAOZHANG_API_KEY = "sk-w4i8II1nU3YzJmfH5aB62d4c9bE44f378807Ff0880A87c3d";
const LAOZHANG_API_BASE = "https://api.laozhang.ai/v1";

/**
 * POST /api/video/generate-sora-video2
 * 使用 sora_video2 系列模型生成视频（支持图生视频和文生视频）
 * 支持的模型：
 * - sora_video2: 竖屏10秒
 * - sora_video2-15s: 竖屏15秒
 * - sora_video2-landscape: 横屏10秒
 * - sora_video2-landscape-15s: 横屏15秒
 * 流程：
 * 1. 如果是图生视频，处理图片（如果是 URL 则下载，如果是本地文件路径则直接使用）
 * 2. 使用本地图片文件上传创建视频任务（文生视频时不传图片）
 * 3. 返回 task id
 */
export async function POST(request: NextRequest) {
  let tempImagePath: string | null = null;
  let isTempFile = false; // 标记是否是临时文件，需要清理

  try {
    const body = await request.json();
    const { 
      prompt, 
      imageUrl, // 可以是 URL 或本地文件路径（文生视频时可选）
      size = "1280x704", // 默认分辨率 1280×704
      seconds = 10, // 默认 10 秒
      model, // 模型名称（可选，如果不提供则根据 size 自动选择）
      aspectRatio // 宽高比（如 "9:16" 或 "16:9"），用于自动选择模型
    } = body;

    // 判断是文生视频还是图生视频（空字符串也视为文生视频）
    const isTextToVideo = !imageUrl || imageUrl.trim() === '';

    // 如果没有指定模型，根据 size 或 aspectRatio 自动选择
    let selectedModel = model;
    if (!selectedModel) {
      // 解析 size 或 aspectRatio 来判断是竖屏还是横屏
      let isPortrait = false;
      
      if (aspectRatio) {
        // 如果提供了 aspectRatio，直接判断
        isPortrait = aspectRatio === "9:16" || aspectRatio.startsWith("9:");
      } else if (size) {
        // 从 size 中解析（格式如 "576x1024" 或 "1280x704"）
        const sizeMatch = size.match(/(\d+)x(\d+)/);
        if (sizeMatch) {
          const width = parseInt(sizeMatch[1]);
          const height = parseInt(sizeMatch[2]);
          // 如果高度大于宽度，则是竖屏
          isPortrait = height > width;
        }
      }
      
      // 根据竖屏/横屏和时长选择模型
      if (isPortrait) {
        selectedModel = seconds === 15 ? "sora_video2-15s" : "sora_video2";
      } else {
        selectedModel = seconds === 15 ? "sora_video2-landscape-15s" : "sora_video2-landscape";
      }
    }


    if (!prompt) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    // 如果是图生视频，处理图片
    if (!isTextToVideo && imageUrl) {
      // 判断是本地文件路径还是 URL
      const isLocalPath = !imageUrl.startsWith("http://") && !imageUrl.startsWith("https://") && fs.existsSync(imageUrl);
      
      if (isLocalPath) {
        // 直接使用本地文件路径
        tempImagePath = imageUrl;
        isTempFile = false; // 不是临时文件，不需要清理
      } else {
        // 下载图片到临时目录
        const tempDir = path.join(process.cwd(), "tmp");
        // 确保临时目录存在
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // 生成临时文件名
        const tempImageFilename = `temp-image-${randomUUID()}.png`;
        tempImagePath = path.join(tempDir, tempImageFilename);
        isTempFile = true; // 是临时文件，需要清理

        // 下载图片
        try {
          // 如果是 TOS URL，生成预签名 URL
          let finalImageUrl = imageUrl;
          const isTosUrl = imageUrl.includes('tos-') || imageUrl.includes('.volces.com') || imageUrl.includes('volces.com');
          if (isTosUrl) {
            finalImageUrl = await tosClient.getImagePresignedUrl(imageUrl, 3600); // 1小时有效期
          }

          const imageResponse = await fetch(finalImageUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
          }

          // 将图片保存到临时文件
          if (!tempImagePath) {
            throw new Error('Temporary image path is not set');
          }
          const fileStream = fs.createWriteStream(tempImagePath);
          await streamPipeline(imageResponse.body as any, fileStream);
        } catch (downloadError) {
          // 清理临时文件
          if (tempImagePath && fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath);
          }
          throw new Error(`Failed to download image: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`);
        }
      }

      // 验证文件是否存在
      if (!tempImagePath) {
        throw new Error('Image path is not set');
      }
      // 使用类型断言，因为我们已经检查过 tempImagePath 不为 null
      const imagePath: string = tempImagePath;
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }
    }

    // 使用本地图片文件上传创建视频任务（文生视频时不传图片）
    const formData = new FormData();
    formData.append("model", selectedModel); // 使用自动选择或传入的模型名称
    formData.append("prompt", prompt); // 严格使用传入的 prompt（视频描述）
    formData.append("size", size); // 分辨率（如 1280x704 或 576x1024）
    formData.append("seconds", String(seconds)); // 时长（10 或 15 秒）
    
    // 只有图生视频时才添加图片
    if (!isTextToVideo && tempImagePath) {
      // tempImagePath 已经在上面的检查中确认为非 null
      const imagePath: string = tempImagePath;
      formData.append("input_reference", fs.createReadStream(imagePath), {
        filename: path.basename(imagePath),
        contentType: "image/png",
      });
    }

    // 打印发送到 API 的参数
    console.log("========== 发送到 API 的参数 ==========");
    console.log("API URL:", `${LAOZHANG_API_BASE}/videos`);
    console.log("FormData 参数:", {
      model: selectedModel,
      prompt,
      input_reference: isTextToVideo ? "[not provided - text-to-video]" : `[file: ${tempImagePath}]`,
      size,
      seconds: String(seconds),
    });
    console.log("图片文件路径:", tempImagePath || "[not provided - text-to-video]");
    console.log("=======================================");

    // 将 form-data 转换为 buffer（Node.js fetch 需要）
    // form-data 实例是一个可读流，需要读取所有数据到 buffer
    const formDataBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      formData.on('data', (chunk: Buffer | string) => {
        // 确保 chunk 是 Buffer 类型
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      formData.on('end', () => resolve(Buffer.concat(chunks)));
      formData.on('error', reject);
      // 确保流开始读取
      formData.resume();
    });

    // 使用 form-data 的 buffer 作为 body
    const createResponse = await fetch(`${LAOZHANG_API_BASE}/videos`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LAOZHANG_API_KEY}`,
        ...formData.getHeaders(), // 添加 Content-Type 和 boundary
      },
      body: formDataBuffer as any, // Buffer 可以用于 fetch body
    });

    // 清理临时图片文件（仅当是临时文件时）
    if (isTempFile && tempImagePath && fs.existsSync(tempImagePath)) {
      try {
        fs.unlinkSync(tempImagePath);
      } catch (cleanupError) {
        // 忽略清理错误
      }
    }

    if (!createResponse.ok) {
      const errorText = await createResponse.text().catch(() => "Unknown error");
      console.error("API 错误响应:", errorText);
      throw new Error(`API error: ${createResponse.status} ${errorText}`);
    }

    // 尝试解析 JSON 响应
    let result;
    try {
      const responseText = await createResponse.text();
      console.log("API 响应文本:", responseText);
      result = JSON.parse(responseText);
    } catch (jsonError) {
      console.error("JSON 解析错误:", jsonError);
      throw new Error(`Failed to parse API response as JSON. Response status: ${createResponse.status}`);
    }

    // 打印 API 响应结果
    console.log("========== API 响应结果 ==========");
    console.log("响应状态:", createResponse.status, createResponse.statusText);
    console.log("响应数据:", JSON.stringify(result, null, 2));
    console.log("=================================");

    return NextResponse.json({
      success: true,
      data: {
        taskId: result.id,
        status: result.status,
        createdAt: result.created_at,
        expiresAt: result.expires_at,
      },
    });
  } catch (error) {
    // 确保清理临时文件（仅当是临时文件时）
    if (isTempFile && tempImagePath && fs.existsSync(tempImagePath)) {
      try {
        fs.unlinkSync(tempImagePath);
      } catch (cleanupError) {
        // 忽略清理错误
      }
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate video",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

