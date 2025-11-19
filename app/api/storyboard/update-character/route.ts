import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * API Route: 更新项目中的角色信息
 * 更新 story_outline.characters 数组中的特定角色
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
    const { project_id, character_id, character_data } = body;

    if (!project_id || !character_id || !character_data) {
      return NextResponse.json(
        { success: false, error: "project_id, character_id, and character_data are required" },
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

    // 从 anim_story_outlines 表获取角色信息
    // 注意：角色信息存储在独立的 characters 字段中，而不是 story_outline.characters
    const { data: storyOutlineRecord, error: outlineError } = await supabase
      .from("anim_story_outlines")
      .select("characters")
      .eq("project_id", project_id)
      .single();

    if (outlineError || !storyOutlineRecord) {
      console.error("Error fetching story outline:", outlineError);
      return NextResponse.json(
        { success: false, error: "Story outline not found" },
        { status: 404 }
      );
    }

    // 解析 characters 数组
    let characters: any[] = [];
    if (storyOutlineRecord.characters) {
      try {
        characters = typeof storyOutlineRecord.characters === 'string' 
          ? JSON.parse(storyOutlineRecord.characters) 
          : storyOutlineRecord.characters;
        
        // 确保是数组
        if (!Array.isArray(characters)) {
          characters = [];
        }
      } catch (e) {
        console.error("Failed to parse characters:", e);
        return NextResponse.json(
          { success: false, error: "Failed to parse characters" },
          { status: 500 }
        );
      }
    }

    // 查找并更新角色
    const characterIndex = characters.findIndex(
      (char: any) => char.id === character_id
    );

    if (characterIndex === -1) {
      console.error("Character not found. character_id:", character_id);
      console.error("Available character IDs:", characters.map((c: any) => c.id));
      return NextResponse.json(
        { success: false, error: "Character not found" },
        { status: 404 }
      );
    }

    // 更新角色数据
    // 注意：需要保留原有角色的所有字段，然后更新传入的字段
    // 这样可以确保不会丢失任何信息
    const existingCharacter = characters[characterIndex];
    characters[characterIndex] = {
      ...existingCharacter, // 保留原有角色的所有字段
      ...character_data, // 更新传入的字段
      id: character_id, // 确保ID不被覆盖
    };

    console.log("=== 更新角色信息 ===");
    console.log("character_id:", character_id);
    console.log("原有角色数据:", JSON.stringify(existingCharacter, null, 2));
    console.log("传入的更新数据:", JSON.stringify(character_data, null, 2));
    console.log("合并后的角色数据:", JSON.stringify(characters[characterIndex], null, 2));
    console.log("合并后的角色 image_url:", characters[characterIndex].image_url);

    // 更新 anim_story_outlines 表的 characters 字段
    const { error: updateError } = await supabase
      .from("anim_story_outlines")
      .update({
        characters: characters,
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", project_id);

    if (updateError) {
      console.error("Error updating character:", updateError);
      return NextResponse.json(
        { success: false, error: `Failed to update character: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        character: characters[characterIndex],
      },
    });
  } catch (error) {
    console.error("Error updating character:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

