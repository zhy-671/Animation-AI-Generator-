import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSceneWithItems } from '@/lib/supabase/scenes';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

// Store export tasks in memory (in production, use Redis or database)
const exportTasks = new Map<string, {
  status: string;
  progress: number;
  videoUrl?: string;
  error?: string;
}>();

/**
 * POST /api/projects/export-video
 * 开始视频合成导出任务
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, sceneId, videoClips, subtitles, includeSubtitles } = body;
    const supabase = await createClient();

    // 验证用户身份
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 验证场景
    const sceneData = await getSceneWithItems(sceneId);
    if (!sceneData || sceneData.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Scene not found or access denied' },
        { status: 403 }
      );
    }

    if (!videoClips || videoClips.length === 0) {
      return NextResponse.json(
        { error: 'No video clips provided' },
        { status: 400 }
      );
    }

    // 生成任务ID
    const taskId = uuidv4();
    
    // 初始化任务状态
    exportTasks.set(taskId, {
      status: 'preparing',
      progress: 0,
    });

    // 异步处理导出任务
    processExportTask(taskId, videoClips, subtitles || [], includeSubtitles, projectId, sceneId).catch((error) => {
      console.error('Export task error:', error);
      const task = exportTasks.get(taskId);
      if (task) {
        task.status = 'error';
        task.error = error.message || 'Export failed';
      }
    });

    return NextResponse.json({
      success: true,
      taskId,
    });
  } catch (error) {
    console.error('Error starting export:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to start export',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/export-video/progress?taskId=xxx
 * 获取导出进度（Server-Sent Events）
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json(
      { error: 'taskId is required' },
      { status: 400 }
    );
  }

  // 创建 SSE 响应
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      
      // 发送初始状态
      const task = exportTasks.get(taskId);
      if (task) {
        const data = JSON.stringify({
          status: task.status,
          progress: task.progress,
          videoUrl: task.videoUrl,
          error: task.error,
          completed: task.status === 'completed',
        });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      // 定期检查进度
      const interval = setInterval(() => {
        const task = exportTasks.get(taskId);
        if (task) {
          const data = JSON.stringify({
            status: task.status,
            progress: task.progress,
            videoUrl: task.videoUrl,
            error: task.error,
            completed: task.status === 'completed' || task.status === 'error',
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));

          // 如果完成或出错，关闭连接
          if (task.status === 'completed' || task.status === 'error') {
            clearInterval(interval);
            controller.close();
          }
        } else {
          clearInterval(interval);
          controller.close();
        }
      }, 1000); // 每秒更新一次

      // 清理函数
      return () => {
        clearInterval(interval);
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * 处理导出任务
 */
async function processExportTask(
  taskId: string,
  videoClips: Array<{ url: string; startTime: number; duration: number }>,
  subtitles: Array<{ text: string; startTime: number; endTime: number; x?: number; y?: number }>,
  includeSubtitles: boolean,
  projectId: string,
  sceneId: string
) {
  const workDir = join(tmpdir(), `export-${taskId}`);
  let finalVideoPath: string | null = null;

  try {
    // 创建临时目录
    await mkdir(workDir, { recursive: true });

    // 更新状态
    updateTaskStatus(taskId, 'preparing', 10);

    // 下载所有视频
    const videoPaths: string[] = [];
    for (let i = 0; i < videoClips.length; i++) {
      const clip = videoClips[i];
      const videoPath = join(workDir, `clip_${i}.mp4`);
      
      try {
        const response = await fetch(clip.url);
        if (!response.ok) {
          console.error(`Failed to download video ${i + 1}: ${response.statusText}`);
          continue; // Skip failed downloads but continue with others
        }
        
        const buffer = await response.arrayBuffer();
        await writeFile(videoPath, Buffer.from(buffer));
        videoPaths.push(videoPath);
      } catch (error) {
        console.error(`Error downloading video ${i + 1}:`, error);
        // Continue with other videos
      }
      
      updateTaskStatus(taskId, 'preparing', 10 + (i + 1) / videoClips.length * 20);
    }

    if (videoPaths.length === 0) {
      throw new Error('No videos were successfully downloaded');
    }

    // 更新状态
    updateTaskStatus(taskId, 'merging', 30);

    // 创建视频列表文件（用于 FFmpeg concat）
    const concatListPath = join(workDir, 'concat_list.txt');
    const concatList = videoPaths.map(path => `file '${path.replace(/'/g, "'\\''")}'`).join('\n');
    await writeFile(concatListPath, concatList);

    // 合并视频
    const mergedVideoPath = join(workDir, 'merged.mp4');
    try {
      await execAsync(
        `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c copy "${mergedVideoPath}" -y`
      );
    } catch (error) {
      console.error('FFmpeg concat error:', error);
      // 如果concat失败，尝试重新编码合并
      await execAsync(
        `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c:v libx264 -c:a aac "${mergedVideoPath}" -y`
      );
    }

    updateTaskStatus(taskId, 'merging', 60);

    // 如果需要添加字幕
    if (includeSubtitles && subtitles.length > 0) {
      updateTaskStatus(taskId, 'adding-subtitles', 65);

      // 创建字幕文件（SRT格式）
      const srtPath = join(workDir, 'subtitles.srt');
      const srtContent = generateSRT(subtitles);
      await writeFile(srtPath, srtContent);

      // 使用FFmpeg添加字幕
      finalVideoPath = join(workDir, 'final.mp4');
      // 转义SRT路径中的特殊字符
      const escapedSrtPath = srtPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      await execAsync(
        `ffmpeg -i "${mergedVideoPath}" -vf "subtitles='${escapedSrtPath}':force_style='FontSize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,Alignment=2,MarginV=50'" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k "${finalVideoPath}" -y`
      );

      updateTaskStatus(taskId, 'adding-subtitles', 85);
    } else {
      finalVideoPath = mergedVideoPath;
    }

    // 更新状态
    updateTaskStatus(taskId, 'finalizing', 90);

    // 上传到存储（这里需要根据你的存储方案实现）
    // 暂时返回本地路径（实际应该上传到云存储）
    const videoUrl = await uploadVideo(finalVideoPath, projectId, sceneId);

    // 完成
    const task = exportTasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.progress = 100;
      task.videoUrl = videoUrl;
    }
  } catch (error) {
    console.error('Export task error:', error);
    const task = exportTasks.get(taskId);
    if (task) {
      task.status = 'error';
      task.error = error instanceof Error ? error.message : 'Export failed';
    }
  } finally {
    // 清理临时文件（可选，可以保留一段时间以便调试）
    // await cleanupWorkDir(workDir);
  }
}

/**
 * 更新任务状态
 */
function updateTaskStatus(taskId: string, status: string, progress: number) {
  const task = exportTasks.get(taskId);
  if (task) {
    task.status = status;
    task.progress = Math.min(100, Math.max(0, progress));
  }
}

/**
 * 生成SRT字幕文件内容
 */
function generateSRT(subtitles: Array<{ text: string; startTime: number; endTime: number }>): string {
  return subtitles
    .map((sub, index) => {
      const start = formatSRTTime(sub.startTime);
      const end = formatSRTTime(sub.endTime);
      return `${index + 1}\n${start} --> ${end}\n${sub.text}\n`;
    })
    .join('\n');
}

/**
 * 格式化SRT时间
 */
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

/**
 * 上传视频到存储
 */
async function uploadVideo(videoPath: string, projectId: string, sceneId: string): Promise<string> {
  try {
    // 读取视频文件
    const videoBuffer = await readFile(videoPath);
    
    // 生成唯一文件名
    const fileName = `${projectId}/${sceneId}/exported_${Date.now()}_${uuidv4()}.mp4`;
    
    // 上传到火山存储
    const videoUrl = await tosClient.uploadVideo(videoBuffer, fileName);
    
    return videoUrl;
  } catch (error) {
    console.error('Error uploading video:', error);
    throw new Error('Failed to upload video to storage');
  }
}

