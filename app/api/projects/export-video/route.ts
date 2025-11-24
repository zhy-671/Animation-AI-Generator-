import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSceneWithItems } from '@/lib/supabase/scenes';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { tosClient } from '@/lib/volcano/storage';
import { getServiceRoleClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';

const execAsync = promisify(exec);

type ExportTaskRow = {
  id: string;
  user_id: string;
  status: string;
  progress: number;
  video_url: string | null;
  error: string | null;
};

type TaskStatusUpdate = {
  status?: string;
  progress?: number;
  videoUrl?: string | null;
  error?: string | null;
};

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

    const adminSupabase = getServiceRoleClient();
    const { data: createdTask, error: createTaskError } = await adminSupabase
      .from('project_export_tasks')
      .insert({
        user_id: user.id,
        project_id: projectId,
        scene_id: sceneId,
        status: 'preparing',
        progress: 0,
        include_subtitles: includeSubtitles ?? false,
        subtitles: subtitles || [],
        video_clips: videoClips,
      })
      .select('id, user_id, created_at')
      .single();

    if (createTaskError || !createdTask) {
      return NextResponse.json(
        { error: 'Failed to create export task' },
        { status: 500 }
      );
    }

    const taskId = createdTask.id;
    // 异步处理导出任务
    processExportTask(taskId, videoClips, subtitles || [], includeSubtitles, projectId, sceneId).catch((error) => {
      const adminClient = getServiceRoleClient();
      updateTaskStatusRecord(adminClient, taskId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Export failed',
        progress: 100,
      }).catch((updateError) => {
      });
    });

    return NextResponse.json({
      success: true,
      taskId,
    });
  } catch (error) {
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
 * 获取导出进度
 * 支持两种模式：
 * 1. SSE (Server-Sent Events): 如果 Accept 头包含 text/event-stream
 * 2. JSON: 普通 JSON 响应（用于手动检查状态）
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json(
      { error: 'taskId is required' },
      { status: 400 }
    );
  }

  // 检查是否是 SSE 请求
  const acceptHeader = request.headers.get('accept') || '';
  const isSSERequest = acceptHeader.includes('text/event-stream');

  // 如果不是 SSE 请求，返回 JSON 响应（用于手动检查状态）
  const userSupabase = await createClient();
  const { data: { user }, error: userError } = await userSupabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const adminSupabase = getServiceRoleClient();
  const { task, ownershipMismatch } = await fetchTaskForUser(adminSupabase, taskId, user.id);
  if (!task) {
    if (ownershipMismatch) {
      return NextResponse.json(
        { error: 'Not authorized to access this task' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Task not found' },
      { status: 404 }
    );
  }
  if (!isSSERequest) {
    return NextResponse.json(buildTaskResponse(task));
  }

  // SSE 响应
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      
      async function pushUpdate(): Promise<boolean> {
        const { task: latestTask, ownershipMismatch: mismatch } = await fetchTaskForUser(adminSupabase, taskId, user.id);
        if (!latestTask) {
          const errorMessage = mismatch ? 'Not authorized to access this task' : 'Task not found';
          const data = JSON.stringify({
            status: 'error',
            progress: 0,
            error: errorMessage,
            completed: true,
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          controller.close();
          return true;
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(buildTaskResponse(latestTask))}\n\n`));
        return latestTask.status === 'completed' || latestTask.status === 'error';
      }

      pushUpdate().catch((error) => {
        controller.close();
      });

      // 定期检查进度
      const interval = setInterval(() => {
        pushUpdate()
          .then((isFinished) => {
            if (isFinished) {
              clearInterval(interval);
              controller.close();
            }
          })
          .catch((error) => {
            clearInterval(interval);
            controller.close();
          });
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
  const adminSupabase = getServiceRoleClient();
  const updateStatus = (updates: TaskStatusUpdate) => updateTaskStatusRecord(adminSupabase, taskId, updates);

  try {
    // 创建临时目录
    await mkdir(workDir, { recursive: true });

    // 更新状态
    await updateStatus({ status: 'preparing', progress: 10 });

    // 下载所有视频（带并发控制）
    const videoPaths = await downloadVideoClips(videoClips, workDir, async (status, progress) => {
      await updateStatus({ status, progress });
    });

    if (videoPaths.length === 0) {
      throw new Error('No videos were successfully downloaded');
    }

    // 更新状态
    await updateStatus({ status: 'merging', progress: 30 });

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
    } catch (error: any) {
      // 检查是否是 FFmpeg 未安装的错误
      // 检查多种可能的错误信息格式（包括中文乱码）
      const firstErrorMessage = error?.stderr || error?.message || String(error);
      const firstErrorLower = firstErrorMessage.toLowerCase();
      
      // 检查错误代码和常见错误模式
      const isFFmpegNotFoundFirst = 
        error?.code === 1 && // Windows 命令未找到通常返回 code 1
        (
          firstErrorLower.includes('不是内部或外部') ||
          firstErrorLower.includes('也不是可运行') ||
          firstErrorLower.includes('not found') || 
          firstErrorLower.includes('command not found') ||
          firstErrorLower.includes('not recognized') ||
          firstErrorLower.includes('is not recognized') ||
          (firstErrorLower.includes("'ffmpeg'") && firstErrorLower.includes('不是')) ||
          (firstErrorLower.includes("'ffmpeg'") && firstErrorLower.includes('not'))
        );
      
      if (isFFmpegNotFoundFirst) {
        throw new Error('FFmpeg is not installed or not in PATH. Please restart your development server after installing FFmpeg.');
      }
      
      // 如果concat失败，尝试重新编码合并
      try {
        await execAsync(
          `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c:v libx264 -c:a aac "${mergedVideoPath}" -y`
        );
      } catch (retryError: any) {
        // 提取 FFmpeg 错误信息
        const errorMessage = retryError?.stderr || retryError?.message || String(retryError);
        const errorLower = errorMessage.toLowerCase();
        
        // 检查错误代码和常见错误模式
        const isFFmpegNotFound = 
          retryError?.code === 1 && // Windows 命令未找到通常返回 code 1
          (
            errorLower.includes('不是内部或外部') ||
            errorLower.includes('也不是可运行') ||
            errorLower.includes('not found') || 
            errorLower.includes('command not found') ||
            errorLower.includes('not recognized') ||
            errorLower.includes('is not recognized') ||
            (errorLower.includes("'ffmpeg'") && errorLower.includes('不是')) ||
            (errorLower.includes("'ffmpeg'") && errorLower.includes('not'))
          );
        
        if (isFFmpegNotFound) {
          throw new Error('FFmpeg is not installed or not in PATH. Please restart your development server after installing FFmpeg.');
        } else {
          // 清理错误信息，移除控制字符
          const cleanErrorMessage = errorMessage.replace(/\r\n/g, ' ').replace(/\n/g, ' ').trim();
          throw new Error(`Video merging failed: ${cleanErrorMessage}`);
        }
      }
    }

    await updateStatus({ status: 'merging', progress: 60 });

    // 如果需要添加字幕
    if (includeSubtitles && subtitles.length > 0) {
      await updateStatus({ status: 'adding-subtitles', progress: 65 });

      // 创建字幕文件（SRT格式）
      const srtPath = join(workDir, 'subtitles.srt');
      let videoWidth: number | null = null;
      let videoHeight: number | null = null;

      try {
        const probeCommand = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of json "${mergedVideoPath}"`;
        const { stdout } = await execAsync(probeCommand);
        const probePayload = stdout?.trim() ? JSON.parse(stdout.trim()) : {};
        const streamInfo = Array.isArray(probePayload?.streams)
          ? probePayload.streams.find((stream: any) => stream?.width && stream?.height)
          : probePayload?.streams;

        if (streamInfo) {
          const widthCandidate = Number(streamInfo.width);
          const heightCandidate = Number(streamInfo.height);
          videoWidth = Number.isFinite(widthCandidate) && widthCandidate > 0 ? widthCandidate : null;
          videoHeight = Number.isFinite(heightCandidate) && heightCandidate > 0 ? heightCandidate : null;
        }
      } catch (probeError) {
      }

      const srtContent = generateSRT(subtitles, { videoWidth, videoHeight });
      await writeFile(srtPath, srtContent);

      // 使用FFmpeg添加字幕
      finalVideoPath = join(workDir, 'final.mp4');
      // 规范化 SRT 路径，避免 FFmpeg 在 Windows 上把 \U 视为转义序列
      const normalizedSrtPath = normalizePathForFFmpegSubtitles(srtPath);
      const { fontSize, marginV } = getSubtitleFilterStyle(videoWidth, videoHeight);
      const subtitleFilter = `subtitles=filename='${normalizedSrtPath}':force_style='FontSize=${fontSize},PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=1,Shadow=1,BorderStyle=1,Alignment=2,MarginV=${marginV}'`;
      try {
        await execAsync(
          `ffmpeg -i "${mergedVideoPath}" -vf "${subtitleFilter}" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k "${finalVideoPath}" -y`
        );
      } catch (error: any) {
        const errorMessage = error?.stderr || error?.message || String(error);
        const errorLower = errorMessage.toLowerCase();
        
        // 检查错误代码和常见错误模式
        const isFFmpegNotFound = 
          error?.code === 1 && // Windows 命令未找到通常返回 code 1
          (
            errorLower.includes('不是内部或外部') ||
            errorLower.includes('也不是可运行') ||
            errorLower.includes('not found') || 
            errorLower.includes('command not found') ||
            errorLower.includes('not recognized') ||
            errorLower.includes('is not recognized') ||
            (errorLower.includes("'ffmpeg'") && errorLower.includes('不是')) ||
            (errorLower.includes("'ffmpeg'") && errorLower.includes('not'))
          );
        
        if (isFFmpegNotFound) {
          throw new Error('FFmpeg is not installed or not in PATH. Please restart your development server after installing FFmpeg.');
        } else {
          // 清理错误信息，移除控制字符
          const cleanErrorMessage = errorMessage.replace(/\r\n/g, ' ').replace(/\n/g, ' ').trim();
          throw new Error(`Failed to add subtitles: ${cleanErrorMessage}`);
        }
      }

      await updateStatus({ status: 'adding-subtitles', progress: 85 });
    } else {
      finalVideoPath = mergedVideoPath;
    }

    // 更新状态
    await updateStatus({ status: 'finalizing', progress: 90 });

    // 上传到存储（这里需要根据你的存储方案实现）
    // 暂时返回本地路径（实际应该上传到云存储）
    const videoUrl = await uploadVideo(finalVideoPath, projectId, sceneId);
    // 完成
    await updateStatus({ status: 'completed', progress: 100, videoUrl });
  } catch (error) {
    await updateStatus({
      status: 'error',
      progress: 100,
      error: error instanceof Error ? error.message : 'Export failed',
    });
  } finally {
    // 清理临时文件（可选，可以保留一段时间以便调试）
    // await cleanupWorkDir(workDir);
  }
}

async function updateTaskStatusRecord(
  supabase: SupabaseClient,
  taskId: string,
  updates: TaskStatusUpdate
) {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.status) {
    payload.status = updates.status;
  }

  if (typeof updates.progress === 'number' && Number.isFinite(updates.progress)) {
    payload.progress = Math.min(100, Math.max(0, Math.round(updates.progress)));
  }

  if ('videoUrl' in updates) {
    payload.video_url = updates.videoUrl ?? null;
  }

  if ('error' in updates) {
    payload.error = updates.error ?? null;
  }
  const { data, error } = await supabase
    .from('project_export_tasks')
    .update(payload)
    .eq('id', taskId)
    .select('id, status, progress, video_url')
    .maybeSingle();

  if (error) {
    // 尝试查询任务是否存在
    const { data: checkData, error: checkError } = await supabase
      .from('project_export_tasks')
      .select('id')
      .eq('id', taskId)
      .maybeSingle();
  } else if (data) {
  } else {
  }
}

/**
 * 生成SRT字幕文件内容
 */
function generateSRT(
  subtitles: Array<{ text: string; startTime: number; endTime: number }>,
  options?: { videoWidth?: number | null; videoHeight?: number | null }
): string {
  const charLimit = calculateSubtitleCharLimit(options?.videoWidth, options?.videoHeight);
  return subtitles
    .map((sub, index) => {
      const start = formatSRTTime(sub.startTime);
      const end = formatSRTTime(sub.endTime);
      const lines = splitSubtitleLines(sub.text, charLimit, 2);
      const payload = lines.length > 0 ? lines.join('\n') : '';
      return `${index + 1}\n${start} --> ${end}\n${payload}\n`;
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
 * 规范化 Windows 路径，避免 FFmpeg 把 \U 等序列解析成尺寸/参数
 * 参考: https://ffmpeg.org/ffmpeg-filters.html#subtitles-1
 */
function normalizePathForFFmpegSubtitles(path: string): string {
  return path
    .replace(/\\/g, '/')     // 使用正斜杠，避免 \U 被视为转义
    .replace(/:/g, '\\:')    // 转义冒号，避免被视为选项分隔符
    .replace(/'/g, "\\'");   // 转义单引号
}

function splitSubtitleLines(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const sanitized = text?.trim();
  if (!sanitized) {
    return [];
  }

  const hasSpaces = /\s/.test(sanitized);
  const units = hasSpaces ? sanitized.split(/\s+/) : sanitized.split('');
  const separator = hasSpaces ? ' ' : '';
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < units.length; i += 1) {
    const unit = units[i];
    const testLine = currentLine ? `${currentLine}${separator}${unit}` : unit;

    if (testLine.length > maxCharsPerLine && currentLine) {
      lines.push(currentLine);
      currentLine = unit;

      if (lines.length === maxLines - 1) {
        const remaining = units.slice(i + 1).join(separator);
        currentLine = remaining ? `${currentLine}${separator}${remaining}` : currentLine;
        break;
      }
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, maxLines);
}

function calculateSubtitleCharLimit(videoWidth?: number | null, videoHeight?: number | null): number {
  const safeWidth = typeof videoWidth === 'number' && videoWidth > 0 ? videoWidth : 1080;
  const safeHeight = typeof videoHeight === 'number' && videoHeight > 0 ? videoHeight : 1920;
  const aspectRatio = safeWidth / safeHeight;
  const isPortrait = aspectRatio < 1;
  const referenceWidth = isPortrait ? 720 : 1080;
  const widthScale = Math.max(0.6, Math.min(1.4, safeWidth / referenceWidth));
  const baseLimit = isPortrait ? 18 : 24;
  const estimated = Math.round(baseLimit * widthScale);
  return Math.max(10, Math.min(32, estimated));
}

function getSubtitleFilterStyle(videoWidth?: number | null, videoHeight?: number | null) {
  const safeWidth = typeof videoWidth === 'number' && videoWidth > 0 ? videoWidth : 1080;
  const safeHeight = typeof videoHeight === 'number' && videoHeight > 0 ? videoHeight : 1920;
  const aspectRatio = safeWidth / safeHeight;
  const isPortrait = aspectRatio < 1;
  const referenceArea = 1080 * 1920;
  const currentArea = safeWidth * safeHeight;
  const areaScale = Math.sqrt(Math.max(0.2, currentArea / referenceArea));
  const ratioScale = isPortrait ? 0.9 : aspectRatio > 2 ? 0.85 : 1;
  const fontSize = Math.round(Math.max(14, Math.min(48, 26 * areaScale * ratioScale)));
  const marginV = Math.max(12, Math.round(safeHeight * 0.02));
  return { fontSize, marginV };
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
    throw new Error('Failed to upload video to storage');
  }
}

/**
 * 并发下载视频片段
 */
async function downloadVideoClips(
  videoClips: Array<{ url: string; startTime: number; duration: number }>,
  workDir: string,
  updateTaskStatusFn: (status: string, progress: number) => Promise<void>
): Promise<string[]> {
  const maxConcurrency = Math.min(3, Math.max(1, videoClips.length));
  const videoPaths: Array<string | null> = new Array(videoClips.length).fill(null);
  let completed = 0;
  let cursor = 0;

  async function downloadClip(index: number) {
    const clip = videoClips[index];
    const videoPath = join(workDir, `clip_${index}.mp4`);

    try {
      const response = await fetch(clip.url);
      if (!response.ok) {
        return;
      }

      const buffer = await response.arrayBuffer();
      await writeFile(videoPath, Buffer.from(buffer));
      videoPaths[index] = videoPath;
    } catch (error) {
    } finally {
      completed += 1;
      const progressPortion = completed / videoClips.length;
      await updateTaskStatusFn('preparing', 10 + progressPortion * 20);
    }
  }

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= videoClips.length) {
        break;
      }
      await downloadClip(index);
    }
  }

  const workers = Array.from({ length: maxConcurrency }, () => worker());
  await Promise.all(workers);

  return videoPaths.filter((path): path is string => Boolean(path));
}

type TaskLookupResult = {
  task: ExportTaskRow | null;
  ownershipMismatch: boolean;
};

async function fetchTaskForUser(
  supabase: SupabaseClient,
  taskId: string,
  userId: string
): Promise<TaskLookupResult> {
  // 首先直接查询任务是否存在（不检查 user_id），用于调试
  const { data: rawTask, error: rawError } = await supabase
    .from('project_export_tasks')
    .select('id, user_id, status, progress, video_url, error, created_at, updated_at')
    .eq('id', taskId)
    .maybeSingle();

  if (rawError) {
    return { task: null, ownershipMismatch: false };
  }

  if (!rawTask) {
    // 尝试查询最近的任务看看是否有类似的任务（用于调试）
    const { data: recentTasks, error: recentError } = await supabase
      .from('project_export_tasks')
      .select('id, user_id, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    // 也查询所有最近的任务（不限制 user_id），用于调试
    const { data: allRecentTasks } = await supabase
      .from('project_export_tasks')
      .select('id, user_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    return { task: null, ownershipMismatch: false };
  }
  if (rawTask.user_id !== userId) {
    return { task: null, ownershipMismatch: true };
  }

  return { task: rawTask, ownershipMismatch: false };
}

function buildTaskResponse(task: ExportTaskRow) {
  return {
    status: task.status,
    progress: task.progress,
    videoUrl: task.video_url,
    error: task.error,
    completed: task.status === 'completed' || task.status === 'error',
  };
}

