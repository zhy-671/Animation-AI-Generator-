import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dashScopeClient } from "@/lib/dashscope/client";
import { tosClient } from "@/lib/volcano/storage";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { tmpdir } from "os";

const execAsync = promisify(exec);

/**
 * POST /api/image-to-music-video/generate
 * 图片转音乐视频：生成视频并合并音频
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
      imageUrl,
      audioUrl,
      prompt,
      audioStartTime = 0,
      audioEndTime,
      duration = 10,
      model = "wan2.5-i2v-preview",
      resolution = "720P",
    } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: "imageUrl is required" },
        { status: 400 }
      );
    }

    if (!audioUrl) {
      return NextResponse.json(
        { success: false, error: "audioUrl is required" },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "prompt is required" },
        { status: 400 }
      );
    }

    // 步骤1: 生成预签名URL（如果是TOS URL）
    let finalImageUrl = imageUrl;
    try {
      const isTosUrl = imageUrl.includes('tos-') || imageUrl.includes('.volces.com') || imageUrl.includes('volces.com');
      if (isTosUrl) {
        finalImageUrl = await tosClient.getImagePresignedUrl(imageUrl, 7 * 24 * 3600);
      }
    } catch (error) {
      console.warn("[ImageToMusicVideo] Failed to generate presigned URL, using original:", error);
    }

    // 步骤2: 生成视频
    console.log("[ImageToMusicVideo] Generating video...");
    const videoRequest = {
      prompt,
      imageUrl: finalImageUrl,
      model: model as "wan2.5-i2v-preview" | "wan2.2-i2v-plus" | "wan2.2-i2v-flash" | "wanx2.1-i2v-plus" | "wanx2.1-i2v-turbo",
      resolution: resolution as "480P" | "720P" | "1080P",
      duration: parseInt(String(duration)),
      promptExtend: true,
      audio: false, // 不生成音频，后面会合并
    };

    const videoResult = await dashScopeClient.generateVideo(videoRequest);
    const taskId = videoResult.taskId;

    // 步骤3: 轮询视频生成状态
    console.log("[ImageToMusicVideo] Polling video status...");
    let videoUrl: string | null = null;
    const maxPollAttempts = 120; // 最多轮询120次（10分钟）
    let pollAttempts = 0;

    while (pollAttempts < maxPollAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // 每5秒轮询一次

      try {
        const statusResult = await dashScopeClient.getVideoStatus(taskId);
        
        if (statusResult.status === "SUCCEEDED" && statusResult.output?.video_url) {
          videoUrl = statusResult.output.video_url;
          console.log("[ImageToMusicVideo] Video generated successfully:", videoUrl);
          break;
        } else if (statusResult.status === "FAILED") {
          throw new Error(statusResult.message || "Video generation failed");
        }
      } catch (error) {
        if (error instanceof TypeError && error.message.includes("fetch")) {
          console.error("[ImageToMusicVideo] Network error during status check:", error);
          pollAttempts++;
          continue;
        }
        throw error;
      }

      pollAttempts++;
    }

    if (!videoUrl) {
      throw new Error("Video generation timeout");
    }

    // 步骤4: 下载视频和音频，合并它们
    console.log("[ImageToMusicVideo] Merging video and audio...");
    const workDir = path.join(tmpdir(), `image-to-music-video-${Date.now()}`);
    await fs.promises.mkdir(workDir, { recursive: true });

    try {
      const videoPath = path.join(workDir, 'video.mp4');
      const audioPath = path.join(workDir, 'audio.mp3');
      const finalVideoPath = path.join(workDir, 'final.mp4');

      // 下载视频
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.status}`);
      }
      const videoBuffer = await videoResponse.arrayBuffer();
      await fs.promises.writeFile(videoPath, Buffer.from(videoBuffer));

      // 下载音频
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.status}`);
      }
      const audioBuffer = await audioResponse.arrayBuffer();
      await fs.promises.writeFile(audioPath, Buffer.from(audioBuffer));

      // 计算音频时长
      const audioDuration = audioEndTime !== undefined 
        ? audioEndTime - audioStartTime 
        : undefined;

      // 使用ffmpeg合并视频和音频
      const atrimFilter = audioDuration !== undefined
        ? `[1:a]atrim=start=${audioStartTime}:duration=${audioDuration}[a1]`
        : `[1:a]atrim=start=${audioStartTime}[a1]`;

      await execAsync(
        `ffmpeg -i "${videoPath}" -i "${audioPath}" -filter_complex "${atrimFilter}" -map 0:v:0 -map "[a1]" -c:v copy -c:a aac "${finalVideoPath}" -y`
      );

      // 上传最终视频到TOS
      console.log("[ImageToMusicVideo] Uploading final video...");
      const finalVideoBuffer = await fs.promises.readFile(finalVideoPath);
      const filename = `image-to-music-video/${user.id}/${Date.now()}.mp4`;
      const finalVideoUrl = await tosClient.uploadVideo(finalVideoBuffer, filename);

      return NextResponse.json({
        success: true,
        data: {
          videoUrl: finalVideoUrl,
          taskId,
        },
      });
    } finally {
      // 清理临时文件
      try {
        await fs.promises.rm(workDir, { recursive: true, force: true });
      } catch (e) {
        console.warn("[ImageToMusicVideo] Failed to clean temp dir", e);
      }
    }
  } catch (error) {
    console.error("[ImageToMusicVideo] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate music video",
      },
      { status: 500 }
    );
  }
}

