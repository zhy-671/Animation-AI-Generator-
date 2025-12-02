import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/music/update
 * 更新音乐信息（歌词、音频URL等）
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
    const { 
      id,
      title,
      prompt, 
      lyrics,
      audioUrl,
      coverUrl,
      metadata
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    // lyrics 字段是布尔类型，表示是否有歌词
    // 如果传入的 lyrics 是字符串（歌词内容），则将其保存到 metadata 中
    let lyricsBool = false;
    let lyricsText = null;
    
    if (typeof lyrics === 'string' && lyrics.trim().length > 0) {
      lyricsBool = true;
      lyricsText = lyrics;
    } else if (typeof lyrics === 'boolean') {
      lyricsBool = lyrics;
    } else if (lyrics) {
      lyricsBool = true;
    }
    
    // 构建 metadata，包含歌词文本（如果有）
    const finalMetadata = {
      ...(metadata || {}),
      ...(lyricsText ? { lyricsText: lyricsText } : {}),
    };

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (prompt !== undefined) updateData.prompt = prompt;
    if (lyricsBool !== undefined) updateData.lyrics = lyricsBool;
    if (audioUrl !== undefined) updateData.audio_url = audioUrl;
    if (coverUrl !== undefined) updateData.cover_url = coverUrl;
    if (finalMetadata) updateData.metadata = finalMetadata;

    // 更新记录
    const { data: updated, error: updateError } = await supabase
      .from('anim_music')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update music: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("[Music Update API] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update music",
      },
      { status: 500 }
    );
  }
}
