import { NextRequest, NextResponse } from "next/server";
import {
  updateSceneItemImage,
  deleteSceneItemImage,
  updateSceneItemText,
} from "@/lib/supabase/scenes";

/**
 * PATCH /api/scenes/items/:itemId
 * 更新分镜项
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const body = await request.json();
    const { imageUrl, text, scene_detail, metadata } = body;
    const { itemId } = await params;

    if (!itemId) {
      return NextResponse.json(
        { error: "itemId is required" },
        { status: 400 }
      );
    }

    // 导入 createClient
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 验证用户权限
    const { data: sceneItem, error: checkError } = await supabase
      .from('anim_scene_items')
      .select('scene_id, anim_scenes!inner(user_id)')
      .eq('id', itemId)
      .single();

    if (checkError || !sceneItem) {
      return NextResponse.json(
        { error: "Scene item not found" },
        { status: 404 }
      );
    }

    // 构建更新数据
    const updateData: any = {};

    if (imageUrl !== undefined) {
      if (imageUrl === null) {
        updateData.image_url = null;
      } else {
        updateData.image_url = imageUrl;
      }
    }

    if (text !== undefined) {
      updateData.text = text;
    }

    if (scene_detail !== undefined) {
      updateData.scene_detail = scene_detail;
    }

    if (metadata !== undefined) {
      // 获取现有的metadata并合并
      const { data: currentItem } = await supabase
        .from('anim_scene_items')
        .select('metadata')
        .eq('id', itemId)
        .single();

      const currentMetadata = currentItem?.metadata || {};
      updateData.metadata = { ...currentMetadata, ...metadata };
    }

    // 执行更新
    const { error: updateError } = await supabase
      .from('anim_scene_items')
      .update(updateData)
      .eq('id', itemId);

    if (updateError) {
      throw new Error(`Failed to update scene item: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error updating scene item:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update scene item",
      },
      { status: 500 }
    );
  }
}

