import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tosClient } from "@/lib/volcano/storage";

/**
 * POST /api/video/upload
 * 上传视频到火山存储 storyvideo bucket
 * 从 DashScope 返回的视频 URL 下载并上传到火山存储
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
    const { videoUrl } = body;

    if (!videoUrl) {
      return NextResponse.json(
        { error: "videoUrl is required" },
        { status: 400 }
      );
    }

    // 生成唯一文件名
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`;

    // 从 DashScope URL 下载视频并上传到火山存储 storyvideo bucket
    const url = await tosClient.uploadVideoFromUrl(videoUrl, fileName);

    return NextResponse.json({
      success: true,
      data: {
        url: url,
        path: fileName,
      },
    });
  } catch (error) {
    console.error("Error uploading video:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to upload video",
      },
      { status: 500 }
    );
  }
}

