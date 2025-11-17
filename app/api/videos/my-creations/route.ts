import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/videos/my-creations
 * 获取当前用户自己生成的视频（用于 My Creations tab）
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { videos: [], error: "User not authenticated" },
        { status: 401 }
      );
    }

    // 查询当前用户的所有已完成视频
    const { data: videos, error: videosError } = await supabase
      .from('anim_videos')
      .select('video_url, prompt, created_at, status')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .not('video_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (videosError) {
      console.error('Error fetching user videos:', videosError);
      return NextResponse.json(
        { videos: [], error: videosError.message },
        { status: 200 }
      );
    }

    // 如果没有视频，返回空数组
    if (!videos || videos.length === 0) {
      return NextResponse.json(
        { videos: [] },
        { status: 200 }
      );
    }

    // 格式化视频数据
    const formattedVideos = videos.map((video, index) => {
      // 从 video_url 提取文件名
      const urlParts = video.video_url.split('/');
      const filename = urlParts[urlParts.length - 1] || `video-${index + 1}.mp4`;
      
      // 生成标题（使用 prompt 或默认标题）
      const title = video.prompt 
        ? (video.prompt.length > 50 ? video.prompt.substring(0, 50) + '...' : video.prompt)
        : `My Video ${index + 1}`;
      
      return {
        url: video.video_url,
        filename: filename,
        title: title
      };
    });

    return NextResponse.json(
      { videos: formattedVideos },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/videos/my-creations:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        videos: [],
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

