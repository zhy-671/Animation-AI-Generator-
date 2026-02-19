import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 验证用户身份
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      musicId,
      audioSegments,
      storyboard,
      sceneData,
      shotData,
      visualStyle,
      orientation,
      characterImageUrl,
    } = body;

    if (!musicId) {
      return NextResponse.json(
        { error: "musicId is required" },
        { status: 400 }
      );
    }

    // 检查是否已存在该音乐的视频数据
    const { data: existingData } = await supabase
      .from("music_video_data")
      .select("id")
      .eq("music_id", musicId)
      .eq("user_id", user.id)
      .single();

    let result;
    if (existingData) {
      // 更新现有记录
      const { data, error } = await supabase
        .from("music_video_data")
        .update({
          audio_segments: audioSegments || [],
          storyboard: storyboard || {},
          scene_data: sceneData || {},
          shot_data: shotData || {},
          visual_style: visualStyle,
          orientation: orientation || '16:9',
          character_image_url: characterImageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingData.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating music video data:", error);
        return NextResponse.json(
          { error: "Failed to update music video data", details: error.message },
          { status: 500 }
        );
      }

      result = data;
    } else {
      // 创建新记录
      const { data, error } = await supabase
        .from("music_video_data")
        .insert({
          music_id: musicId,
          user_id: user.id,
          audio_segments: audioSegments || [],
          storyboard: storyboard || {},
          scene_data: sceneData || {},
          shot_data: shotData || {},
          visual_style: visualStyle,
          orientation: orientation || '16:9',
          character_image_url: characterImageUrl,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating music video data:", error);
        return NextResponse.json(
          { error: "Failed to create music video data", details: error.message },
          { status: 500 }
        );
      }

      result = data;
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error in save-video-data API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 验证用户身份
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const musicId = searchParams.get("musicId");

    if (!musicId) {
      return NextResponse.json(
        { error: "musicId is required" },
        { status: 400 }
      );
    }

    // 查询该音乐的视频数据
    const { data, error } = await supabase
      .from("music_video_data")
      .select("*")
      .eq("music_id", musicId)
      .eq("user_id", user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 记录不存在
        return NextResponse.json({
          success: true,
          data: null,
        });
      }
      console.error("Error fetching music video data:", error);
      return NextResponse.json(
        { error: "Failed to fetch music video data", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
    });
  } catch (error: any) {
    console.error("Error in get-video-data API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

