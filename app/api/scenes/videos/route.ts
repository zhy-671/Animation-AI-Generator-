import { NextRequest, NextResponse } from "next/server";
import {
  createOrUpdateVideo,
  deleteVideo,
} from "@/lib/supabase/scenes";

/**
 * POST /api/scenes/videos
 * 创建或更新视频
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      sceneItemId, 
      videoUrl, 
      prompt, 
      sceneDetail, 
      imageUrl, 
      resolution, 
      taskId, 
      requestId,
      status,
      submitTime,
      scheduledTime,
      endTime,
      origPrompt,
      actualPrompt,
      duration,
      videoCount,
      sr,
      shotNumber // 分镜编号，用于更新metadata.storyboard.shots
    } = body;

    if (!videoUrl) {
      return NextResponse.json(
        { error: "videoUrl is required" },
        { status: 400 }
      );
    }

    // sceneItemId 可以为 null（非分镜模式）
    if (sceneItemId === undefined) {
      return NextResponse.json(
        { error: "sceneItemId is required (can be null for non-scene mode)" },
        { status: 400 }
      );
    }

    const video = await createOrUpdateVideo({
      sceneItemId: sceneItemId || null, // 允许为 null
      videoUrl,
      prompt,
      sceneDetail, // 传递画面描述
      imageUrl,
      resolution,
      taskId,
      requestId, // DashScope API 请求ID
      status,
      submitTime, // DashScope API 任务提交时间
      scheduledTime, // DashScope API 任务计划执行时间
      endTime, // DashScope API 任务结束时间
      origPrompt, // DashScope API 原始提示词
      actualPrompt, // DashScope API 实际使用的提示词
      duration, // 视频时长（秒）
      videoCount, // 视频数量
      sr, // 采样率/分辨率
      shotNumber, // 分镜编号，用于更新metadata.storyboard.shots
    });

    return NextResponse.json({
      success: true,
      data: video,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create/update video",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/scenes/videos?sceneItemId=xxx
 * 删除视频
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sceneItemId = searchParams.get("sceneItemId");

    if (!sceneItemId) {
      return NextResponse.json(
        { error: "sceneItemId is required" },
        { status: 400 }
      );
    }

    await deleteVideo(sceneItemId);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete video",
      },
      { status: 500 }
    );
  }
}

