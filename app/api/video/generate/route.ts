import { NextRequest, NextResponse } from "next/server";
import { dashScopeClient } from "@/lib/dashscope/client";
import { tosClient } from "@/lib/volcano/storage";

/**
 * POST /api/video/generate
 * 生成视频（支持图生视频和文生视频）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      prompt, 
      imageUrl, 
      sceneDetail, 
      model,
      resolution, 
      size,
      duration,
      promptExtend,
      audio,
      audioUrl,
      negativePrompt,
      watermark,
      seed
    } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    // 判断是文生视频还是图生视频
    const isTextToVideo = !imageUrl || model === "wan2.5-t2v-preview";
    
    if (!isTextToVideo && !imageUrl) {
      return NextResponse.json(
        { error: "imageUrl is required for image-to-video" },
        { status: 400 }
      );
    }

    // 如果是图生视频，且图片 URL 是 TOS URL，生成预签名 URL 以确保 DashScope API 可以访问
    let finalImageUrl = imageUrl;
    if (!isTextToVideo && imageUrl) {
      try {
        // 检查是否是 TOS URL（包含 bucket 名称或 endpoint）
        const isTosUrl = imageUrl.includes('tos-') || imageUrl.includes('.volces.com') || imageUrl.includes('volces.com');
        
        if (isTosUrl) {
          console.log("Detected TOS URL, generating presigned URL for DashScope API:", imageUrl);
          // 生成预签名 URL（有效期 7 天，确保视频生成过程中不会过期）
          // 视频生成可能需要较长时间，所以使用较长的有效期
          // getImagePresignedUrl 内部会处理错误，如果失败会返回原始 URL
          finalImageUrl = await tosClient.getImagePresignedUrl(imageUrl, 7 * 24 * 3600); // 7 天 = 604800 秒
          console.log("Generated presigned URL:", finalImageUrl);
        } else {
          console.log("Not a TOS URL, using original URL:", imageUrl);
        }
      } catch (presignError) {
        console.error("Error generating presigned URL, using original URL:", presignError);
        // 如果生成预签名 URL 失败，使用原始 URL（可能 bucket 是公开的）
        finalImageUrl = imageUrl;
      }
    }

    // 构建请求参数
    const videoRequest = {
      prompt,
      ...(finalImageUrl && { imageUrl: finalImageUrl }), // 使用预签名 URL 或原始 URL
      sceneDetail, // 传递画面描述
      ...(model && { model: model as "wan2.5-i2v-preview" | "wan2.2-i2v-plus" | "wan2.2-i2v-flash" | "wanx2.1-i2v-plus" | "wanx2.1-i2v-turbo" | "wan2.5-t2v-preview" }), // 模型名称
      ...(resolution && { resolution: resolution as "480P" | "720P" | "1080P" }), // 分辨率（图生视频）
      ...(size && { size }), // 分辨率（文生视频，格式：宽*高）
      ...(duration && { duration: parseInt(String(duration)) }), // 时长（秒）
      promptExtend: promptExtend !== false,
      ...(audio !== undefined && { audio: audio !== false }), // 默认开启音频（wan2.5-i2v-preview 和 wan2.5-t2v-preview）
      ...(audioUrl && { audioUrl }), // 音频文件 URL
      ...(negativePrompt && { negativePrompt }), // 反向提示词
      ...(watermark !== undefined && { watermark }), // 是否添加水印
      ...(seed && { seed: parseInt(String(seed)) }), // 随机数种子
    };

    // 打印API路由接收到的参数
    console.log("=== API路由接收到的视频生成参数 ===");
    console.log("提示词 (prompt):", prompt);
    console.log("画面描述 (sceneDetail):", sceneDetail);
    console.log("图片URL (imageUrl):", finalImageUrl || imageUrl);
    console.log("模型 (model):", model);
    console.log("分辨率 (resolution):", resolution);
    console.log("时长 (duration):", duration);
    console.log("完整请求对象:", JSON.stringify(videoRequest, null, 2));

    // 提交视频生成任务
    const result = await dashScopeClient.generateVideo(videoRequest);

    return NextResponse.json({
      success: true,
      data: {
        taskId: result.taskId,
        requestId: result.requestId,
      },
    });
  } catch (error) {
    console.error("Error generating video:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate video",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/video/status?taskId=xxx
 * 查询视频生成状态
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId is required" },
        { status: 400 }
      );
    }

    console.log("Querying video status for taskId:", taskId);

    const status = await dashScopeClient.getVideoStatus(taskId);

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Error getting video status:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get video status",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
