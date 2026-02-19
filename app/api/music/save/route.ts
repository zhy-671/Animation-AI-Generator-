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

    console.log("[Music Save API] Received data:", {
      hasTitle: !!title,
      hasPrompt: !!prompt,
      promptLength: prompt?.length || 0,
      hasAudioUrl: !!audioUrl,
      hasCoverUrl: !!coverUrl,
      status,
    });

    // prompt 可以为空字符串，但必须有值（即使是空字符串）
    // 如果 prompt 为空，使用 title 或 description 作为 fallback
    const finalPrompt = prompt || title || '未命名音乐';
    
    if (finalPrompt === undefined || finalPrompt === null) {
      return NextResponse.json(
        { error: "prompt is required (or provide title)" },
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

    // lyrics 字段是布尔类型，表示是否有歌词
    // 如果传入的 lyrics 是字符串（歌词内容），则将其保存到 metadata 中
    let lyricsBool = false;
    let lyricsText = null;
    
    if (typeof lyrics === 'string' && lyrics.trim().length > 0) {
      // 如果传入的是歌词文本，保存到 metadata 中
      lyricsBool = true;
      lyricsText = lyrics;
    } else if (typeof lyrics === 'boolean') {
      lyricsBool = lyrics;
    } else if (lyrics) {
      // 其他非空值也视为有歌词
      lyricsBool = true;
    }
    
    // 构建 metadata，包含歌词文本（如果有）
    const finalMetadata = {
      ...(metadata || {}),
      ...(lyricsText ? { lyricsText: lyricsText } : {}),
    };
    
    const musicData: any = {
      user_id: user.id,
      title: title || null,
      prompt: finalPrompt,
      genre: genre || null,
      mood: mood || null,
      theme: theme || null,
      tempo: tempo || null,
      energy: energy || null,
      lyrics: lyricsBool, // 布尔值：是否有歌词
      instrumental: instrumental || false,
      voice_type: voiceType || (instrumental ? null : 'female'), // 默认女声，伴奏模式为 null
      audio_url: audioUrl || null,
      cover_url: coverUrl || null,
      duration: duration || null,
      status: status || 'pending',
      task_id: taskId || null,
      metadata: finalMetadata,
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
    console.error("[Music Save API] Error:", error);
    console.error("[Music Save API] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save music",
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined,
      },
      { status: 500 }
    );
  }
}

