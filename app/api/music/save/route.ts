import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/music/save
 * 保存用户生成的音乐到数据库
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
      title,
      prompt, 
      genre,
      mood,
      theme,
      tempo,
      energy,
      lyrics,
      instrumental,
      voiceType,
      audioUrl,
      coverUrl,
      duration,
      status,
      taskId,
      metadata
    } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    // 检查是否已存在相同的 taskId 记录
    let existingMusic = null;
    if (taskId) {
      const { data: existing } = await supabase
        .from('anim_music')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', user.id)
        .single();
      
      existingMusic = existing;
    }

    const musicData: any = {
      user_id: user.id,
      title: title || null,
      prompt: prompt,
      genre: genre || null,
      mood: mood || null,
      theme: theme || null,
      tempo: tempo || null,
      energy: energy || null,
      lyrics: lyrics || false,
      instrumental: instrumental || false,
      voice_type: voiceType || (instrumental ? null : 'female'), // 默认女声，伴奏模式为 null
      audio_url: audioUrl || null,
      cover_url: coverUrl || null,
      duration: duration || null,
      status: status || 'pending',
      task_id: taskId || null,
      metadata: metadata || {},
    };

    let music;
    if (existingMusic) {
      // 更新现有记录
      const { data: updated, error: updateError } = await supabase
        .from('anim_music')
        .update(musicData)
        .eq('id', existingMusic.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update music: ${updateError.message}`);
      }

      music = updated;
    } else {
      // 创建新记录
      const { data: inserted, error: insertError } = await supabase
        .from('anim_music')
        .insert(musicData)
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create music: ${insertError.message}`);
      }

      music = inserted;
    }

    return NextResponse.json({
      success: true,
      data: music,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save music",
      },
      { status: 500 }
    );
  }
}

