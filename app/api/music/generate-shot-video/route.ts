import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tosClient } from "@/lib/volcano/storage";

/**
 * POST /api/music/generate-shot-video
 * 为单个分镜生成 Sora 视频（无对口型）
 * 前端只负责调用本接口生成“无口型视频”，对口型由 /api/music/lip-sync 单独处理。
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      shotIndex,
      videoPrompt,
      imageUrl,
      orientation,
      segmentStart,
      segmentEnd,
    } = body;

    if (!videoPrompt || !imageUrl || !orientation || segmentStart === undefined || segmentEnd === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const isPortrait = orientation === "9:16";
    const duration = segmentEnd - segmentStart;
    const seconds = Math.min(Math.max(Math.ceil(duration), 5), 15);

    let selectedModel: string;
    if (isPortrait) {
      selectedModel = seconds === 15 ? "sora_video2-15s" : "sora_video2";
    } else {
      selectedModel = seconds === 15 ? "sora_video2-landscape-15s" : "sora_video2-landscape";
    }

    const size = isPortrait ? "576x1024" : "1280x704";

    console.log("[GenerateShotVideo] Generating Sora video:", {
      shotIndex,
      prompt: videoPrompt.substring(0, 100),
      model: selectedModel,
      size,
      seconds,
      imageUrl: imageUrl.substring(0, 100),
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const soraResponse = await fetch(`${baseUrl}/api/video/generate-sora-video2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: videoPrompt,
        imageUrl,
        size,
        seconds,
        model: selectedModel,
        aspectRatio: orientation,
      }),
    });

    if (!soraResponse.ok) {
      const error = await soraResponse.json().catch(() => ({}));
      console.error("[GenerateShotVideo] Failed to create Sora task:", error);
      return NextResponse.json(
        { success: false, error: error.error || "Failed to generate video with Sora" },
        { status: 500 }
      );
    }

    const soraResult = await soraResponse.json();
    const soraTaskId = soraResult.data?.taskId || soraResult.taskId;

    if (!soraTaskId) {
      console.error("[GenerateShotVideo] Invalid Sora response:", soraResult);
      return NextResponse.json(
        { success: false, error: "Failed to get taskId from Sora video generation response" },
        { status: 500 }
      );
    }

    console.log("[GenerateShotVideo] Sora task created:", soraTaskId);

    // 轮询 Sora 任务状态
    let soraVideoUrl: string | null = null;
    const maxPollAttempts = 60;
    let pollAttempts = 0;

    while (pollAttempts < maxPollAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const statusUrl = `${baseUrl}/api/video/status-sora-video2?taskId=${soraTaskId}`;
      const statusResponse = await fetch(statusUrl, { method: "GET" });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text().catch(() => "Unknown error");
        console.error("[GenerateShotVideo] Status check failed:", {
          status: statusResponse.status,
          statusText: statusResponse.statusText,
          error: errorText,
          taskId: soraTaskId,
        });
        if (statusResponse.status === 404 || statusResponse.status === 400) {
          console.log(`[GenerateShotVideo] Task ${soraTaskId} not found yet, retrying...`);
          pollAttempts++;
          continue;
        }
        return NextResponse.json(
          { success: false, error: `Failed to check Sora video status: ${statusResponse.status} ${errorText}` },
          { status: 500 }
        );
      }

      const statusResult = await statusResponse.json();
      if (statusResult.success && statusResult.data) {
        if (statusResult.data.status === "completed" && statusResult.data.url) {
          soraVideoUrl = statusResult.data.url;
          break;
        } else if (statusResult.data.status === "failed") {
          return NextResponse.json(
            { success: false, error: statusResult.error || "Sora video generation failed" },
            { status: 500 }
          );
        }
      }

      pollAttempts++;
    }

    if (!soraVideoUrl) {
      return NextResponse.json(
        { success: false, error: "Sora video generation timeout" },
        { status: 500 }
      );
    }

    console.log("[GenerateShotVideo] Sora video generated:", soraVideoUrl);

    // 上传到 TOS
    const filename = `music-shot-video/${user.id}/${Date.now()}-${shotIndex}.mp4`;
    const uploadedUrl = await tosClient.uploadVideoFromUrl(soraVideoUrl, filename);

    console.log("[GenerateShotVideo] Final video uploaded:", uploadedUrl);

    return NextResponse.json({
      success: true,
      data: {
        videoUrl: uploadedUrl,
        taskId: soraTaskId,
      },
    });
  } catch (error: any) {
    console.error("[GenerateShotVideo] Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}


