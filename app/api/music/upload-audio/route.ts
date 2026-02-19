import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tosClient } from "@/lib/volcano/storage";

/**
 * POST /api/music/upload-audio
 * 上传 base64 音频到火山存储
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
    const { audioBase64, format = 'mp3' } = body;

    if (!audioBase64) {
      return NextResponse.json(
        { error: "audioBase64 is required" },
        { status: 400 }
      );
    }

    try {
      // 将 base64 字符串转换为 Buffer
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      
      // 生成唯一文件名
      const fileExt = format || 'mp3';
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      // 上传到火山存储
      const url = await tosClient.uploadAudio(audioBuffer, fileName, format);
      
      return NextResponse.json({
        success: true,
        data: {
          url: url,
          path: fileName,
        },
      });
    } catch (uploadError) {
      console.error('[Upload Audio] Error:', uploadError);
      if (uploadError instanceof Error) {
        if (uploadError.message.includes('TOS') || uploadError.message.includes('storage')) {
          return NextResponse.json(
            {
              error: `Storage upload failed: ${uploadError.message}`,
              details: 'Please check storage configuration and try again.',
            },
            { status: 500 }
          );
        }
      }
      throw uploadError;
    }
  } catch (error) {
    console.error('[Upload Audio] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to upload audio",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

