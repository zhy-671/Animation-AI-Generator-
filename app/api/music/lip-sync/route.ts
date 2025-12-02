import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { identifyFace, createLipSyncTask, getLipSyncTaskStatus } from "@/lib/kling/client";
import { tosClient } from "@/lib/volcano/storage";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { tmpdir } from "os";

const execAsync = promisify(exec);

/**
 * POST /api/music/lip-sync
 * 对口型功能
 * 流程：
 * 1. 使用Sora生成视频（根据图片比例选择模型）
 * 2. 调用可灵API进行人脸识别
 * 3. 调用可灵API创建对口型任务
 * 4. 轮询任务状态直到完成
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
      shotIndex, // 分镜索引
      videoPrompt, // 视频描述
      characterDescription, // 人物描述（可选）
      imageUrl, // 分镜图片URL（可选，用于首次生成Sora视频）
      orientation, // 比例 "16:9" 或 "9:16"
      audioUrl, // 音频URL
      audioStartTime, // 音频开始时间（秒）
      audioEndTime, // 音频结束时间（秒）
      segmentStart, // 音频段开始时间（秒）
      segmentEnd, // 音频段结束时间（秒）
      sourceVideoUrl, // 已有视频URL（如果有，则直接对该视频做对口型）
    } = body;

    if (!audioUrl) {
      return NextResponse.json(
        { success: false, error: "audioUrl is required" },
        { status: 400 }
      );
    }

    // 步骤1: 获取用于对口型的基础视频
    let soraVideoUrl: string | null = null;
    // 轮询计数器在整个 handler 内复用，避免作用域问题
    let pollAttempts = 0;

    // 如果前端已经有 Sora 视频，直接使用该视频进行对口型
    if (sourceVideoUrl && typeof sourceVideoUrl === "string") {
      soraVideoUrl = sourceVideoUrl;
      console.log("[LipSync] Using existing source video for lip sync:", {
        shotIndex,
        sourceVideoUrl: sourceVideoUrl.substring(0, 100),
      });
    } else {
      // 否则：根据图片 + 文本，先使用 Sora 生成视频
      if (!videoPrompt || !imageUrl || !orientation || segmentStart === undefined || segmentEnd === undefined) {
        return NextResponse.json(
          { success: false, error: "Missing parameters for Sora video generation" },
          { status: 400 }
        );
      }

      const finalPrompt = characterDescription
        ? `${videoPrompt}，${characterDescription}`
        : videoPrompt;

    // 根据比例选择Sora模型
      const isPortrait = orientation === "9:16";
      const duration = segmentEnd - segmentStart; // 音频段时长
      const seconds = Math.min(Math.max(Math.ceil(duration), 5), 15); // 限制在5-15秒

      let selectedModel: string;
      if (isPortrait) {
        selectedModel = seconds === 15 ? "sora_video2-15s" : "sora_video2";
      } else {
        selectedModel = seconds === 15 ? "sora_video2-landscape-15s" : "sora_video2-landscape";
      }

      const size = isPortrait ? "576x1024" : "1280x704";

      console.log("[LipSync] Generating video with Sora:", {
        prompt: finalPrompt.substring(0, 100),
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
          prompt: finalPrompt,
          imageUrl,
          size,
          seconds,
          model: selectedModel,
          aspectRatio: orientation,
        }),
      });

      if (!soraResponse.ok) {
        const error = await soraResponse.json();
        throw new Error(error.error || "Failed to generate video with Sora");
      }

      const soraResult = await soraResponse.json();
      const soraTaskId = soraResult.data?.taskId || soraResult.taskId;

      if (!soraTaskId) {
        console.error("[LipSync] Sora response:", soraResult);
        throw new Error("Failed to get taskId from Sora video generation response");
      }

      console.log("[LipSync] Sora task created:", soraTaskId);

      // 轮询Sora任务状态直到完成
      const maxPollAttempts = 60; // 最多轮询60次

      while (pollAttempts < maxPollAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 5000)); // 等待5秒

        try {
          const statusUrl = process.env.NEXT_PUBLIC_BASE_URL
            ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/video/status-sora-video2?taskId=${soraTaskId}`
            : `http://localhost:${process.env.PORT || 3000}/api/video/status-sora-video2?taskId=${soraTaskId}`;

          const statusResponse = await fetch(statusUrl, { method: "GET" });

          if (!statusResponse.ok) {
            const errorText = await statusResponse.text().catch(() => "Unknown error");
            console.error("[LipSync] Status check failed:", {
              status: statusResponse.status,
              statusText: statusResponse.statusText,
              error: errorText,
              taskId: soraTaskId,
            });
            if (statusResponse.status === 404 || statusResponse.status === 400) {
              console.log(`[LipSync] Task ${soraTaskId} not found yet, retrying...`);
              pollAttempts++;
              continue;
            }
            throw new Error(`Failed to check Sora video status: ${statusResponse.status} ${errorText}`);
          }

          const statusResult = await statusResponse.json();
          console.log("[LipSync] Sora task status:", {
            taskId: soraTaskId,
            status: statusResult.data?.status,
            progress: statusResult.data?.progress,
            hasUrl: !!statusResult.data?.url,
          });

          if (statusResult.success && statusResult.data) {
            if (statusResult.data.status === "completed" && statusResult.data.url) {
              soraVideoUrl = statusResult.data.url;
              break;
            } else if (statusResult.data.status === "failed") {
              throw new Error(statusResult.error || "Sora video generation failed");
            }
          } else if (statusResult.error) {
            console.warn("[LipSync] Status check returned error:", statusResult.error);
          }
        } catch (error) {
          if (error instanceof TypeError && error.message.includes("fetch")) {
            console.error("[LipSync] Network error during status check:", error);
            pollAttempts++;
            continue;
          }
          throw error;
        }

        pollAttempts++;
      }

      if (!soraVideoUrl) {
        throw new Error("Sora video generation timeout");
      }

      console.log("[LipSync] Sora video generated:", soraVideoUrl);
    }

    // 步骤2: 调用可灵API进行人脸识别
    console.log("[LipSync] Identifying faces in video...");
    const identifyResult = await identifyFace({
      video_url: soraVideoUrl,
    });

    if (!identifyResult.data.face_data || identifyResult.data.face_data.length === 0) {
      throw new Error("No faces detected in video");
    }

    const sessionId = identifyResult.data.session_id;
    const firstFace = identifyResult.data.face_data[0]; // 使用第一个人脸

    console.log("[LipSync] Face identified:", {
      sessionId,
      faceId: firstFace.face_id,
      faceTimeRange: [firstFace.start_time, firstFace.end_time],
    });

    // 步骤3: 创建对口型任务
    // 这里需要保证传给 Kling 的 sound_file 就是「该音频段」本身，而不是整首歌
    // 1）先用 ffmpeg 把 [segmentStart, segmentEnd] 这一段音频裁出来，上传到 TOS
    const workDir = path.join(tmpdir(), `lip-sync-audio-${Date.now()}-${shotIndex}`);
    await fs.promises.mkdir(workDir, { recursive: true });

    const originalAudioPath = path.join(workDir, "source-audio.mp3");
    const clippedAudioPath = path.join(workDir, "segment-audio.mp3");

    let clippedAudioUrl: string;
    let segmentDuration: number;

    try {
      // 下载原始整首音频
      const audioResp = await fetch(audioUrl);
      if (!audioResp.ok) {
        throw new Error(`Failed to download audio for lip sync: ${audioResp.status} ${audioResp.statusText}`);
      }
      const audioBuf = Buffer.from(await audioResp.arrayBuffer());
      await fs.promises.writeFile(originalAudioPath, audioBuf);

      // 计算片段时长并限制在 60s 内（Kling 要求）
      segmentDuration = segmentEnd - segmentStart;
      if (!Number.isFinite(segmentDuration) || segmentDuration <= 0) {
        segmentDuration = 1;
      }
      if (segmentDuration > 60) {
        segmentDuration = 60;
      }

      // 使用 ffmpeg 裁剪该片段
      const startSec = Math.max(0, segmentStart);
      const ffmpegCmd = `ffmpeg -y -i "${originalAudioPath}" -ss ${startSec} -t ${segmentDuration} -acodec copy "${clippedAudioPath}"`;
      await execAsync(ffmpegCmd);

      const clippedBuffer = await fs.promises.readFile(clippedAudioPath);
      const clippedFilename = `lip-sync-audio/${user.id}/${Date.now()}-${shotIndex}.mp3`;
      clippedAudioUrl = await tosClient.uploadAudio(clippedBuffer, clippedFilename, "mp3");
    } finally {
      // 清理临时文件
      try {
        await fs.promises.rm(workDir, { recursive: true, force: true });
      } catch (e) {
        console.warn("[LipSync] Failed to clean temp audio dir", e);
      }
    }

    // 计算音频裁剪时间（毫秒）——对于裁好的一段音频，起点永远是 0，终点是该段时长
    const soundStartTime = 0;
    const soundEndTime = Math.round(segmentDuration * 1000);
    const soundInsertTime = firstFace.start_time; // 使用人脸识别的开始时间

    console.log("[LipSync] Creating lip sync task...", {
      sessionId,
      faceId: firstFace.face_id,
      soundStartTime,
      soundEndTime,
      soundInsertTime,
      audioUrl: clippedAudioUrl.substring(0, 100),
    });

    const lipSyncResult = await createLipSyncTask({
      session_id: sessionId,
      face_choose: [
        {
          face_id: firstFace.face_id,
          sound_file: clippedAudioUrl, // 传裁剪好的音频段 URL
          sound_start_time: soundStartTime,
          sound_end_time: soundEndTime,
          sound_insert_time: soundInsertTime,
          sound_volume: 1.0,
          original_audio_volume: 0.0, // 静音原视频
        },
      ],
      external_task_id: `lip-sync-${shotIndex}-${Date.now()}`,
    });

    const lipSyncTaskId = lipSyncResult.data.task_id;
    console.log("[LipSync] Lip sync task created:", lipSyncTaskId);

    // 步骤4: 轮询对口型任务状态
    let finalVideoUrl: string | null = null;
    pollAttempts = 0;
    const maxLipSyncPollAttempts = 120; // 最多轮询120次（10分钟）

    while (pollAttempts < maxLipSyncPollAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // 等待5秒

      const taskStatus = await getLipSyncTaskStatus(lipSyncTaskId);
      console.log("[LipSync] Task status:", taskStatus.data.task_status);

      if (taskStatus.data.task_status === "succeed") {
        if (taskStatus.data.task_result?.videos && taskStatus.data.task_result.videos.length > 0) {
          finalVideoUrl = taskStatus.data.task_result.videos[0].url;
          break;
        }
      } else if (taskStatus.data.task_status === "failed") {
        throw new Error(
          taskStatus.data.task_status_msg || "Lip sync task failed"
        );
      }

      pollAttempts++;
    }

    if (!finalVideoUrl) {
      throw new Error("Lip sync task timeout");
    }

    // 上传最终视频到云存储
    const filename = `music-lip-sync/${user.id}/${Date.now()}-${shotIndex}.mp4`;
    const uploadedUrl = await tosClient.uploadVideoFromUrl(finalVideoUrl, filename);

    console.log("[LipSync] Final video uploaded:", uploadedUrl);

    return NextResponse.json({
      success: true,
      data: {
        videoUrl: uploadedUrl,
        taskId: lipSyncTaskId,
      },
    });
  } catch (error) {
    console.error("[LipSync] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

