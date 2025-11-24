import { NextRequest, NextResponse } from "next/server";
import { tosClient } from "@/lib/volcano/storage";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { pipeline } from "stream";
import { randomUUID } from "crypto";

const streamPipeline = promisify(pipeline);

const LAOZHANG_API_KEY = "sk-w4i8II1nU3YzJmfH5aB62d4c9bE44f378807Ff0880A87c3d";
const LAOZHANG_API_BASE = "https://api.laozhang.ai/v1";

/**
 * POST /api/video/download-sora-video2
 * 下载 sora_video2-landscape 生成的视频并上传到云存储
 * 流程：
 * 1. 从 API 下载视频到临时目录
 * 2. 上传视频到云存储
 * 3. 删除临时视频文件
 */
export async function POST(request: NextRequest) {
  let tempVideoPath: string | null = null;

  try {
    const body = await request.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId is required" },
        { status: 400 }
      );
    }

    // 1. 先查询视频状态，获取下载 URL
    const statusResponse = await fetch(`${LAOZHANG_API_BASE}/videos/${taskId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${LAOZHANG_API_KEY}`,
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text().catch(() => "Unknown error");
      throw new Error(`Failed to get video status: ${statusResponse.status} ${errorText}`);
    }

    const statusResult = await statusResponse.json();

    if (statusResult.status !== "completed") {
      return NextResponse.json(
        { error: `Video is not completed yet. Current status: ${statusResult.status}` },
        { status: 400 }
      );
    }

    if (!statusResult.url) {
      return NextResponse.json(
        { error: "Video download URL not available" },
        { status: 400 }
      );
    }

    // 2. 下载视频到临时目录
    const tempDir = path.join(process.cwd(), "tmp");
    // 确保临时目录存在
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 生成临时文件名
    const tempVideoFilename = `temp-video-${randomUUID()}.mp4`;
    tempVideoPath = path.join(tempDir, tempVideoFilename);

    try {
      // 构建完整的下载 URL
      const downloadUrl = statusResult.url.startsWith("http")
        ? statusResult.url
        : `${LAOZHANG_API_BASE}${statusResult.url}`;

      const videoResponse = await fetch(downloadUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${LAOZHANG_API_KEY}`,
        },
      });

      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`);
      }

      // 将视频保存到临时文件
      const fileStream = fs.createWriteStream(tempVideoPath);
      await streamPipeline(videoResponse.body as any, fileStream);
    } catch (downloadError) {
      // 清理临时文件
      if (tempVideoPath && fs.existsSync(tempVideoPath)) {
        fs.unlinkSync(tempVideoPath);
      }
      throw new Error(`Failed to download video: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`);
    }

    // 3. 上传视频到云存储
    const videoBuffer = fs.readFileSync(tempVideoPath);
    const filename = `videos/${Date.now()}-${randomUUID()}.mp4`;
    const videoUrl = await tosClient.uploadVideo(videoBuffer, filename);

    // 4. 删除临时视频文件
    if (tempVideoPath && fs.existsSync(tempVideoPath)) {
      try {
        fs.unlinkSync(tempVideoPath);
      } catch (cleanupError) {
        // 忽略清理错误
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        videoUrl: videoUrl,
        taskId: taskId,
      },
    });
  } catch (error) {
    // 确保清理临时文件
    if (tempVideoPath && fs.existsSync(tempVideoPath)) {
      try {
        fs.unlinkSync(tempVideoPath);
      } catch (cleanupError) {
        // 忽略清理错误
      }
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to download and upload video",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

