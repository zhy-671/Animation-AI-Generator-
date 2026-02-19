import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tosClient } from "@/lib/volcano/storage";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { pipeline } from "stream";
import { randomUUID } from "crypto";
import { exec } from "child_process";
import { tmpdir } from "os";
import { deductVideoCredits } from "@/lib/credits/deduct";
import { getVideoCredits } from "@/lib/credits/rules";

const streamPipeline = promisify(pipeline);
const execAsync = promisify(exec);

// 日志函数
const log = (step: string, message: string, data?: any) => {
  console.log(`[MV Generation] [${step}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

const LAOZHANG_API_KEY = "sk-w4i8II1nU3YzJmfH5aB62d4c9bE44f378807Ff0880A87c3d";
const LAOZHANG_API_BASE = "https://api.laozhang.ai/v1";

/**
 * POST /api/music/generate-mv
 * 批量生成MV视频并拼接
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      scenes, // 场景列表，每个场景包含 soraPrompt, timeRange, duration
      aspectRatio, // "16:9" 或 "9:16"
      audioUrl, // 音频URL
      audioStartTime, // 音频开始时间
      audioEndTime, // 音频结束时间
    } = body;

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json(
        { error: "scenes are required" },
        { status: 400 }
      );
    }

    if (!aspectRatio) {
      return NextResponse.json(
        { error: "aspectRatio is required" },
        { status: 400 }
      );
    }

    // 根据宽高比设置size
    const isPortrait = aspectRatio === "9:16";
    const size = isPortrait ? "720x1280" : "1280x704";
    const resolution = isPortrait ? "720p" : "720p"; // 统一使用720p计算积分

    log("INIT", `开始生成MV，场景数量: ${scenes.length}`, { aspectRatio, size, resolution });

    // 步骤1: 为每个场景生成视频任务
    log("STEP1", "开始为每个场景创建视频生成任务");
    const videoTasks: Array<{
      sceneId: number;
      taskId: string;
      duration: number;
      timeRange: [number, number];
      soraPrompt: string;
    }> = [];

    for (const scene of scenes) {
      if (!scene.soraPrompt || !scene.duration) {
        log("STEP1", `场景 ${scene.sceneId} 跳过：缺少必要参数`);
        continue;
      }

      // 确保场景时长为15秒（Sora模型要求）
      const sceneDuration = Math.min(15, Math.max(5, scene.duration)); // 限制在5-15秒之间，优先15秒
      
      // 根据分辨率和时长选择模型
      let selectedModel: string | undefined;
      if (isPortrait) {
        selectedModel = sceneDuration === 15 ? "sora_video2-15s" : "sora_video2";
      } else {
        selectedModel = sceneDuration === 15 ? "sora_video2-landscape-15s" : "sora_video2-landscape";
      }

      log("STEP1", `场景 ${scene.sceneId} 创建任务`, { sceneDuration, selectedModel });

      try {
        // 调用视频生成API
        const generateResponse = await fetch(`${request.nextUrl.origin}/api/video/generate-sora-video2`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: scene.soraPrompt,
            size: size,
            seconds: sceneDuration,
            aspectRatio: aspectRatio,
            model: selectedModel, // 明确指定模型
          }),
        });

        if (!generateResponse.ok) {
          const errorText = await generateResponse.text();
          log("STEP1", `场景 ${scene.sceneId} 创建任务失败`, { status: generateResponse.status, error: errorText });
          throw new Error(`Failed to generate video for scene ${scene.sceneId}: ${generateResponse.status}`);
        }

        const generateData = await generateResponse.json();
        if (!generateData.data?.taskId) {
          log("STEP1", `场景 ${scene.sceneId} 创建任务失败：缺少taskId`, generateData);
          throw new Error(`Failed to get taskId for scene ${scene.sceneId}`);
        }

        log("STEP1", `场景 ${scene.sceneId} 任务创建成功`, { taskId: generateData.data.taskId });
        videoTasks.push({
          sceneId: scene.sceneId,
          taskId: generateData.data.taskId,
          duration: scene.duration,
          timeRange: scene.timeRange || [0, scene.duration],
          soraPrompt: scene.soraPrompt,
        });
      } catch (error) {
        log("STEP1", `场景 ${scene.sceneId} 创建任务异常`, { error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    }

    log("STEP1", `所有任务创建完成，共 ${videoTasks.length} 个任务`);

    // 步骤2: 轮询所有视频生成状态，确保每个视频都生成成功
    log("STEP2", "开始轮询视频生成状态");
    const videoUrls: Array<{
      sceneId: number;
      url: string;
      duration: number;
      timeRange: [number, number];
      credits: number; // 记录该视频的积分消耗
    }> = [];
    const failedScenes: Array<{
      sceneId: number;
      error: string;
    }> = [];

    const maxAttempts = 120; // 最多轮询120次（约30分钟）
    const pollInterval = 15000; // 15秒轮询一次

    for (const task of videoTasks) {
      log("STEP2", `开始轮询场景 ${task.sceneId} 的状态`, { taskId: task.taskId });
      let attempts = 0;
      let videoUrl: string | null = null;
      let statusError: string | null = null;

      try {
        while (attempts < maxAttempts) {
          const statusResponse = await fetch(`${request.nextUrl.origin}/api/video/status-sora-video2?taskId=${task.taskId}`);
          
          if (!statusResponse.ok) {
            const errorText = await statusResponse.text();
            log("STEP2", `场景 ${task.sceneId} 状态查询失败`, { status: statusResponse.status, error: errorText });
            statusError = `Failed to check video status: ${statusResponse.status}`;
            break;
          }

          const statusData = await statusResponse.json();
          log("STEP2", `场景 ${task.sceneId} 状态更新`, { 
            attempt: attempts + 1, 
            status: statusData.data?.status 
          });
          
          if (statusData.data?.status === "completed" && statusData.data?.url) {
            videoUrl = statusData.data.url;
            log("STEP2", `场景 ${task.sceneId} 生成完成`, { url: videoUrl });
            break;
          } else if (statusData.data?.status === "failed") {
            statusError = `Video generation failed for scene ${task.sceneId}`;
            log("STEP2", `场景 ${task.sceneId} 生成失败`, { error: statusError });
            break;
          }

          attempts++;
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        if (!videoUrl && !statusError) {
          statusError = `Video generation timeout for scene ${task.sceneId}`;
          log("STEP2", `场景 ${task.sceneId} 超时`, { attempts });
        }

        if (statusError) {
          failedScenes.push({
            sceneId: task.sceneId,
            error: statusError,
          });
          log("STEP2", `场景 ${task.sceneId} 失败，跳过`, { error: statusError });
          continue; // 跳过失败的场景，继续处理其他场景
        }

        // 下载视频并上传到云存储
        log("STEP2", `场景 ${task.sceneId} 开始下载视频`, { url: videoUrl });
        const downloadResponse = await fetch(`${request.nextUrl.origin}/api/video/download-sora-video2`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            taskId: task.taskId,
          }),
        });

        if (!downloadResponse.ok) {
          const errorText = await downloadResponse.text();
          log("STEP2", `场景 ${task.sceneId} 下载失败`, { status: downloadResponse.status, error: errorText });
          failedScenes.push({
            sceneId: task.sceneId,
            error: `Failed to download video: ${downloadResponse.status}`,
          });
          continue;
        }

        const downloadData = await downloadResponse.json();
        if (!downloadData.data?.videoUrl) {
          log("STEP2", `场景 ${task.sceneId} 下载失败：缺少videoUrl`, downloadData);
          failedScenes.push({
            sceneId: task.sceneId,
            error: "Failed to get video URL from download response",
          });
          continue;
        }

        // 计算该视频的积分消耗
        const sceneDuration = Math.min(15, Math.max(5, task.duration));
        const credits = getVideoCredits(resolution as '480p' | '720p' | '1080p', sceneDuration);

        log("STEP2", `场景 ${task.sceneId} 下载成功`, { 
          videoUrl: downloadData.data.videoUrl,
          credits 
        });

        videoUrls.push({
          sceneId: task.sceneId,
          url: downloadData.data.videoUrl,
          duration: task.duration,
          timeRange: task.timeRange,
          credits,
        });
      } catch (error) {
        log("STEP2", `场景 ${task.sceneId} 处理异常`, { error: error instanceof Error ? error.message : String(error) });
        failedScenes.push({
          sceneId: task.sceneId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    log("STEP2", `视频生成完成`, { 
      success: videoUrls.length, 
      failed: failedScenes.length,
      total: videoTasks.length 
    });

    // 如果有失败的场景，返回错误信息
    if (failedScenes.length > 0) {
      log("STEP2", "部分场景生成失败", failedScenes);
      // 继续处理成功的场景，但会在响应中返回失败信息
    }

    // 如果所有场景都失败了，直接返回错误
    if (videoUrls.length === 0) {
      log("STEP2", "所有场景生成失败");
      return NextResponse.json({
        success: false,
        error: "All video scenes failed to generate",
        failedScenes,
      }, { status: 500 });
    }

    // 步骤3: 扣除成功的视频积分（只扣成功的）
    log("STEP3", "开始扣除视频生成积分");
    const totalCredits = videoUrls.reduce((sum, video) => sum + video.credits, 0);
    log("STEP3", `准备扣除积分`, { totalCredits, videoCount: videoUrls.length });

    try {
      // 扣除所有成功视频的积分
      const deductResult = await deductVideoCredits(
        resolution as '480p' | '720p' | '1080p',
        videoUrls[0]?.duration || 15, // 使用第一个视频的时长作为参考
        {
          type: 'mv_generation',
          sceneCount: videoUrls.length,
          totalCredits,
          videoUrls: videoUrls.map(v => ({ sceneId: v.sceneId, credits: v.credits })),
        }
      );

      if (!deductResult.success) {
        log("STEP3", "积分扣除失败", { error: deductResult.error });
        // 积分扣除失败，但不影响视频生成流程，继续处理
      } else {
        log("STEP3", "积分扣除成功", { newBalance: deductResult.newBalance });
      }
    } catch (error) {
      log("STEP3", "积分扣除异常", { error: error instanceof Error ? error.message : String(error) });
      // 积分扣除异常，但不影响视频生成流程，继续处理
    }

    // 步骤4: 按顺序拼接视频
    log("STEP4", "开始拼接视频");
    const workDir = path.join(tmpdir(), `mv-${randomUUID()}`);
    await fs.promises.mkdir(workDir, { recursive: true });

    try {
      // 按场景ID排序，确保顺序正确
      videoUrls.sort((a, b) => a.sceneId - b.sceneId);
      log("STEP4", `视频已排序，共 ${videoUrls.length} 个视频`);

      // 下载所有视频
      log("STEP4", "开始下载视频文件");
      const videoPaths: string[] = [];
      for (let i = 0; i < videoUrls.length; i++) {
        const video = videoUrls[i];
        const videoPath = path.join(workDir, `scene_${video.sceneId}.mp4`);
        
        log("STEP4", `下载场景 ${video.sceneId} 视频`, { url: video.url });
        const videoResponse = await fetch(video.url);
        if (!videoResponse.ok) {
          log("STEP4", `场景 ${video.sceneId} 下载失败`, { status: videoResponse.status });
          throw new Error(`Failed to download video ${video.sceneId}: ${videoResponse.status}`);
        }

        const buffer = await videoResponse.arrayBuffer();
        await fs.promises.writeFile(videoPath, Buffer.from(buffer));
        videoPaths.push(videoPath);
        log("STEP4", `场景 ${video.sceneId} 下载完成`, { size: buffer.byteLength });
      }

      // 创建concat列表文件
      log("STEP4", "创建视频拼接列表");
      const concatListPath = path.join(workDir, 'concat_list.txt');
      const concatList = videoPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
      await fs.promises.writeFile(concatListPath, concatList);

      // 拼接视频
      log("STEP4", "开始拼接视频");
      const mergedVideoPath = path.join(workDir, 'merged.mp4');
      try {
        await execAsync(
          `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c copy "${mergedVideoPath}" -y`
        );
        log("STEP4", "视频拼接成功（使用copy模式）");
      } catch (error) {
        log("STEP4", "视频拼接失败，尝试重新编码", { error: error instanceof Error ? error.message : String(error) });
        // 如果concat失败，尝试重新编码
        await execAsync(
          `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c:v libx264 -c:a aac "${mergedVideoPath}" -y`
        );
        log("STEP4", "视频拼接成功（使用重新编码模式）");
      }

      // 步骤5: 同步音频
      log("STEP5", "开始同步音频");
      let finalVideoPath = mergedVideoPath;
      if (audioUrl && audioStartTime !== undefined) {
        const audioSyncedPath = path.join(workDir, 'final.mp4');
        
        // 下载音频
        log("STEP5", "下载音频文件", { audioUrl, audioStartTime, audioEndTime });
        const audioPath = path.join(workDir, 'audio.mp3');
        const audioResponse = await fetch(audioUrl);
        if (audioResponse.ok) {
          const audioBuffer = await audioResponse.arrayBuffer();
          await fs.promises.writeFile(audioPath, Buffer.from(audioBuffer));
          log("STEP5", "音频下载完成", { size: audioBuffer.byteLength });

          // 计算音频时长
          const audioDuration = audioEndTime !== undefined 
            ? audioEndTime - audioStartTime 
            : undefined;
          
          // 合并视频和音频，从音频的startTime开始，到endTime结束
          // 使用 -filter_complex 来精确控制：视频从头开始，音频从 startTime 开始，截取到 endTime
          log("STEP5", "合并视频和音频", { 
            videoPath: mergedVideoPath, 
            audioPath, 
            audioStartTime,
            audioEndTime,
            audioDuration
          });
          
          // 如果指定了结束时间，使用 duration 参数精确截取
          const atrimFilter = audioDuration !== undefined
            ? `[1:a]atrim=start=${audioStartTime}:duration=${audioDuration}[a1]`
            : `[1:a]atrim=start=${audioStartTime}[a1]`;
          
          await execAsync(
            `ffmpeg -i "${mergedVideoPath}" -i "${audioPath}" -filter_complex "${atrimFilter}" -map 0:v:0 -map "[a1]" -c:v copy -c:a aac "${audioSyncedPath}" -y`
          );
          finalVideoPath = audioSyncedPath;
          log("STEP5", "音频同步完成");
        } else {
          log("STEP5", "音频下载失败", { status: audioResponse.status });
        }
      }

      // 步骤6: 上传最终视频到云存储
      log("STEP6", "上传最终视频到云存储");
      const finalVideoBuffer = await fs.promises.readFile(finalVideoPath);
      const filename = `music-videos/${user.id}/${Date.now()}-${randomUUID()}.mp4`;
      const finalVideoUrl = await tosClient.uploadVideo(finalVideoBuffer, filename);
      log("STEP6", "视频上传成功", { videoUrl: finalVideoUrl, size: finalVideoBuffer.length });

      // 清理临时文件
      await fs.promises.rm(workDir, { recursive: true, force: true });
      log("STEP6", "临时文件清理完成");

      log("SUCCESS", "MV生成完成", {
        videoUrl: finalVideoUrl,
        sceneCount: videoUrls.length,
        failedScenes: failedScenes.length,
      });

      return NextResponse.json({
        success: true,
        data: {
          videoUrl: finalVideoUrl,
          sceneCount: videoUrls.length,
          failedScenes: failedScenes.length > 0 ? failedScenes : undefined,
        },
      });
    } catch (error) {
      log("ERROR", "视频拼接/合成失败", { error: error instanceof Error ? error.message : String(error) });
      
      // 合成失败，需要扣除所有已成功视频的积分（因为合成失败，所有视频都浪费了）
      if (videoUrls.length > 0) {
        log("ERROR", "合成失败，准备扣除所有已成功视频的积分", { totalCredits });
        try {
          // 注意：这里实际上已经在步骤3扣除了积分，如果合成失败，理论上应该退还积分
          // 但根据用户要求"合成失败则全部扣分"，所以这里不需要退还
          log("ERROR", "合成失败，已扣除的积分不再退还（按用户要求）");
        } catch (deductError) {
          log("ERROR", "处理积分扣除异常", { error: deductError instanceof Error ? deductError.message : String(error) });
        }
      }

      // 清理临时文件
      await fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  } catch (error) {
    log("FATAL", "MV生成流程异常", { error: error instanceof Error ? error.message : String(error) });
    console.error("[Generate MV API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate MV",
      },
      { status: 500 }
    );
  }
}

