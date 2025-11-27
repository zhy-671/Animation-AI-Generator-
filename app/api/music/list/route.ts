import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/music/list
 * 获取用户的所有音乐
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { data: musicList, error } = await supabase
      .from('anim_music')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch music: ${error.message}`);
    }

    // 转换数据格式以匹配前端接口
    const formattedMusic = musicList?.map(music => ({
      id: music.id,
      title: music.title || music.prompt,
      prompt: music.prompt,
      genre: music.genre,
      mood: music.mood,
      theme: music.theme,
      tempo: music.tempo,
      energy: music.energy,
      lyrics: music.lyrics,
      instrumental: music.instrumental,
      audioUrl: music.audio_url,
      coverUrl: music.cover_url,
      duration: music.duration,
      status: music.status,
      taskId: music.task_id,
      createdAt: music.created_at,
      metadata: music.metadata,
    })) || [];

    return NextResponse.json({
      success: true,
      data: formattedMusic,
      count: formattedMusic.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch music",
      },
      { status: 500 }
    );
  }
}

