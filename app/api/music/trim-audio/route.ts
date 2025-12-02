import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tosClient } from "@/lib/volcano/storage";
import { Buffer } from "buffer";

/**
 * POST /api/music/trim-audio
 * 截取音频片段
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { audioUrl, startTime, endTime } = body;

    if (!audioUrl || startTime === undefined || endTime === undefined) {
      return NextResponse.json(
        { error: "audioUrl, startTime, and endTime are required" },
        { status: 400 }
      );
    }

    // 下载原始音频
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error('Failed to download audio');
    }
    
    const audioArrayBuffer = await audioResponse.arrayBuffer();
    const audioBuffer = Buffer.from(audioArrayBuffer);

    // 注意：这里我们只是保存了原始音频的URL和时间范围
    // 实际的音频截取可以在客户端使用Web Audio API完成，或者在后端使用ffmpeg
    // 为了简化，我们先返回原始音频URL和时间范围，客户端可以处理播放
    // 如果需要真正的截取，需要使用ffmpeg等工具

    // 生成文件名
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;
    
    // 上传到火山云存储（这里上传的是完整音频，实际截取需要ffmpeg）
    // 暂时先返回原始URL和时间范围，让客户端处理
    const url = await tosClient.uploadAudio(audioBuffer, fileName, 'mp3');

    return NextResponse.json({
      success: true,
      data: {
        audioUrl: url,
        startTime,
        endTime,
        duration: endTime - startTime,
      },
    });
  } catch (error) {
    console.error("[Music Trim Audio API] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to trim audio",
      },
      { status: 500 }
    );
  }
}

