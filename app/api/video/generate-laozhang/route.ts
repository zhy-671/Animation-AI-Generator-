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
 * POST /api/video/generate-laozhang
 * 使用 laozhang.ai API 生成视频（图生视频）
 * 流程：
 * 1. 下载图片到临时目录
 * 2. 使用本地图片文件上传创建视频任务
 * 3. 返回 task id
 */
export async function POST(request: NextRequest) {
  let tempImagePath: string | null = null;

  try {
    const body = await request.json();
    const { 
      prompt, 
      imageUrl, 
      size = "1280x720",
      seconds = 10
    } = body;

    // 打印创建视频的参数日志
    console.log("========== 创建视频参数日志 ==========");
    console.log("请求参数:", {
      prompt,
      imageUrl,
      size,
      seconds,
    });
    console.log("完整请求体:", JSON.stringify(body, null, 2));
    console.log("=====================================");

    if (!prompt) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: "imageUrl is required for image-to-video" },
        { status: 400 }
      );
    }

    // 1. 下载图片到临时目录
    const tempDir = path.join(process.cwd(), "tmp");
    // 确保临时目录存在
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 生成临时文件名
    const tempImageFilename = `temp-image-${randomUUID()}.png`;
    tempImagePath = path.join(tempDir, tempImageFilename);

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
      const fileStream = fs.createWriteStream(tempImagePath);
      await streamPipeline(imageResponse.body as any, fileStream);
    } catch (downloadError) {
      // 清理临时文件
      if (tempImagePath && fs.existsSync(tempImagePath)) {
        fs.unlinkSync(tempImagePath);
      }
      throw new Error(`Failed to download image: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`);
    }

    // 2. 使用本地图片文件上传创建视频任务
    const formData = new FormData();
    formData.append("model", "sora-2");
    formData.append("prompt", prompt);
    formData.append("size", size);
    formData.append("seconds", String(seconds));
    formData.append("input_reference", fs.createReadStream(tempImagePath), {
      filename: tempImageFilename,
      contentType: "image/png",
    });

    // 打印发送到 laozhang API 的参数
    console.log("========== 发送到 laozhang API 的参数 ==========");
    console.log("API URL:", `${LAOZHANG_API_BASE}/videos`);
    console.log("FormData 参数:", {
      model: "sora-2",
      prompt,
      input_reference: `[file: ${tempImagePath}]`,
      size,
      seconds: String(seconds),
    });
    console.log("临时图片路径:", tempImagePath);
    console.log("================================================");

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
      body: formDataBuffer,
    });

    // 清理临时图片文件
    if (tempImagePath && fs.existsSync(tempImagePath)) {
      try {
        fs.unlinkSync(tempImagePath);
      } catch (cleanupError) {
        // 忽略清理错误
      }
    }

    if (!createResponse.ok) {
      const errorText = await createResponse.text().catch(() => "Unknown error");
      throw new Error(`Laozhang API error: ${createResponse.status} ${errorText}`);
    }

    const result = await createResponse.json();

    // 打印 API 响应结果
    console.log("========== laozhang API 响应结果 ==========");
    console.log("响应状态:", createResponse.status, createResponse.statusText);
    console.log("响应数据:", JSON.stringify(result, null, 2));
    console.log("==========================================");

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
    // 确保清理临时文件
    if (tempImagePath && fs.existsSync(tempImagePath)) {
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

