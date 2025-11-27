import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/music/update
 * 更新用户生成的音乐
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
      genre,
      mood,
      theme,
      tempo,
      energy,
      lyrics,
      instrumental,
      audioUrl,
      coverUrl,
      duration,
      status,
      metadata
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    // 构建更新数据
    const updateData: any = {};
    
    if (title !== undefined) updateData.title = title;
    if (prompt !== undefined) updateData.prompt = prompt;
    if (genre !== undefined) updateData.genre = genre;
    if (mood !== undefined) updateData.mood = mood;
    if (theme !== undefined) updateData.theme = theme;
    if (tempo !== undefined) updateData.tempo = tempo;
    if (energy !== undefined) updateData.energy = energy;
    if (lyrics !== undefined) updateData.lyrics = lyrics;
    if (instrumental !== undefined) updateData.instrumental = instrumental;
    if (audioUrl !== undefined) updateData.audio_url = audioUrl;
    if (coverUrl !== undefined) updateData.cover_url = coverUrl;
    if (duration !== undefined) updateData.duration = duration;
    if (status !== undefined) updateData.status = status;

    if (metadata !== undefined) {
      // 获取现有的metadata并合并
      const { data: currentMusic } = await supabase
        .from('anim_music')
        .select('metadata')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      const currentMetadata = currentMusic?.metadata || {};
      updateData.metadata = { ...currentMetadata, ...metadata };
    }

    // 执行更新
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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update music",
      },
      { status: 500 }
    );
  }
}

