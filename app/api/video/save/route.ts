import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/video/save
 * 保存非分镜模式的视频到数据库（不需要 sceneItemId）
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
      videoUrl, 
      prompt, 
      resolution, 
      taskId, 
      requestId,
      status,
      submitTime,
      scheduledTime,
      endTime,
      origPrompt,
      actualPrompt,
      duration,
      videoCount,
      size // 文生视频的分辨率（格式：宽*高）
    } = body;

    if (!videoUrl) {
      return NextResponse.json(
        { error: "videoUrl is required" },
        { status: 400 }
      );
    }

    // 检查是否已存在相同的 taskId 记录
    let existingVideo = null;
    if (taskId) {
      const { data: existing } = await supabase
        .from('anim_videos')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', user.id)
        .is('scene_item_id', null) // 非分镜模式的视频
        .single();
      
      existingVideo = existing;
    }

    const videoData: any = {
      user_id: user.id,
      scene_item_id: null, // 非分镜模式，没有 scene_item_id
      video_url: videoUrl,
      prompt: prompt || null,
      image_url: null, // 非分镜模式没有图片
      thumbnail_url: null, // 非分镜模式没有缩略图
      resolution: resolution || size || '1080P',
      task_id: taskId || null,
      request_id: requestId || null,
      status: status || 'completed',
      submit_time: submitTime || null,
      scheduled_time: scheduledTime || null,
      end_time: endTime || null,
      orig_prompt: origPrompt || null,
      actual_prompt: actualPrompt || null,
      duration: duration || null,
      video_count: videoCount || null,
      sr: null, // 文生视频可能没有 sr 字段
      metadata: {
        isTextToVideo: true, // 标记为文生视频
        size: size || null, // 保存文生视频的分辨率格式
      },
    };

    let video;
    if (existingVideo) {
      // 更新现有记录
      const { data: updated, error: updateError } = await supabase
        .from('anim_videos')
        .update(videoData)
        .eq('id', existingVideo.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update video: ${updateError.message}`);
      }

      video = updated;
    } else {
      // 创建新记录
      const { data: inserted, error: insertError } = await supabase
        .from('anim_videos')
        .insert(videoData)
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create video: ${insertError.message}`);
      }

      video = inserted;
    }

    return NextResponse.json({
      success: true,
      data: video,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save video",
      },
      { status: 500 }
    );
  }
}

