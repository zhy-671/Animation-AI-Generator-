import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * API Route: 更新分镜中的视频描述
 * 更新 anim_scene_items.metadata.storyboard.shots[shotNumber].video_prompt
 */
export async function PATCH(request: NextRequest) {
  try {
    // 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { project_id, scene_item_id, shot_number, video_prompt } = body;

    if (!project_id || !scene_item_id || shot_number === undefined || !video_prompt) {
      return NextResponse.json(
        { success: false, error: "project_id, scene_item_id, shot_number, and video_prompt are required" },
        { status: 400 }
      );
    }

    // 验证项目存在且属于当前用户
    const { data: project, error: projectError } = await supabase
      .from("anim_storyboard_projects")
      .select("id")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    // 获取当前的分镜项数据
    const { data: sceneItem, error: sceneItemError } = await supabase
      .from("anim_scene_items")
      .select("metadata, project_id")
      .eq("id", scene_item_id)
      .single();

    if (sceneItemError || !sceneItem) {
      return NextResponse.json(
        { success: false, error: "Scene item not found" },
        { status: 404 }
      );
    }

    // 验证分镜项属于当前项目
    if (sceneItem.project_id !== project_id) {
      return NextResponse.json(
        { success: false, error: "Scene item does not belong to this project" },
        { status: 403 }
      );
    }

    // 解析 metadata
    let metadata: any = {};
    if (sceneItem.metadata) {
      try {
        metadata = typeof sceneItem.metadata === 'string' 
          ? JSON.parse(sceneItem.metadata) 
          : sceneItem.metadata;
      } catch (e) {
        return NextResponse.json(
          { success: false, error: "Failed to parse metadata" },
          { status: 500 }
        );
      }
    }

    // 确保 storyboard.shots 结构存在
    if (!metadata.storyboard) {
      metadata.storyboard = {};
    }
    if (!metadata.storyboard.shots) {
      metadata.storyboard.shots = [];
    }

    // 查找并更新对应的 shot
    const shotIndex = metadata.storyboard.shots.findIndex(
      (shot: any) => shot.shot_number === shot_number
    );

    if (shotIndex === -1) {
      return NextResponse.json(
        { success: false, error: `Shot ${shot_number} not found` },
        { status: 404 }
      );
    }

    // 更新 video_prompt
    const existingShot = metadata.storyboard.shots[shotIndex];
    metadata.storyboard.shots[shotIndex] = {
      ...existingShot,
      video_prompt: video_prompt.trim(),
    };
    // 更新数据库
    const { error: updateError } = await supabase
      .from("anim_scene_items")
      .update({
        metadata: metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scene_item_id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: `Failed to update shot description: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        shot: metadata.storyboard.shots[shotIndex],
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

