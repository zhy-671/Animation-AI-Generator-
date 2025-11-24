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
    // 更新 anim_story_outlines 表的 characters 字段
    const { error: updateError } = await supabase
      .from("anim_story_outlines")
      .update({
        characters: characters,
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", project_id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: `Failed to update character: ${updateError.message}` },
        { status: 500 }
      );
    }

    // 同时更新或插入到 anim_characters 表
    const updatedCharacter = characters[characterIndex];
    const characterName = updatedCharacter.name || character_data.name || "";
    if (!characterName) {
    } else {
      // 检查 anim_characters 表中是否已存在该角色
      // 首先尝试根据 character_id (如果存在) 查找，否则根据 name 查找
      let existingChar: any = null;
      
      // 方法1: 如果 character_id 是 UUID 格式，尝试直接查找
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(character_id);
      if (isUUID) {
        const { data: charById, error: checkByIdError } = await supabase
          .from("anim_characters")
          .select("id, name")
          .eq("id", character_id)
          .eq("project_id", project_id)
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (!checkByIdError && charById) {
          existingChar = charById;
        }
      }
      
      // 方法2: 如果方法1没找到，根据 name 查找
      if (!existingChar) {
        const { data: charByName, error: checkByNameError } = await supabase
          .from("anim_characters")
          .select("id, name")
          .eq("project_id", project_id)
          .eq("user_id", user.id)
          .eq("name", characterName)
          .maybeSingle();
        
        if (checkByNameError && checkByNameError.code !== 'PGRST116') {
        } else if (charByName) {
          existingChar = charByName;
        } else {
        }
      }

      // 辅助函数：确保值是数组格式
      const ensureArray = (value: any): string[] => {
        if (Array.isArray(value)) {
          return value.filter(item => item !== null && item !== undefined && item !== '');
        }
        if (typeof value === 'string' && value.trim() !== '') {
          // 尝试解析 JSON 字符串
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              return parsed.filter(item => item !== null && item !== undefined && item !== '');
            }
          } catch (e) {
            // 如果不是 JSON，作为单个元素返回
            return [value.trim()];
          }
        }
        return [];
      };

      // 准备要保存到 anim_characters 的数据
      const characterRecord: any = {
        project_id: project_id,
        user_id: user.id,
        name: characterName,
        role: updatedCharacter.role || character_data.role || null,
        age: updatedCharacter.age || character_data.age || null,
        gender: updatedCharacter.gender || character_data.gender || null,
        description: updatedCharacter.description || character_data.description || null,
        appearance: updatedCharacter.appearance || character_data.appearance || {},
        clothing_style: updatedCharacter.clothing_style || character_data.clothing_style || {},
        personality_traits: updatedCharacter.personality_traits || character_data.personality_traits || null,
        background: updatedCharacter.background || character_data.background || null,
        // 确保数组字段始终是数组格式
        skills_abilities: ensureArray(updatedCharacter.skills_abilities || character_data.skills_abilities),
        relationships: ensureArray(updatedCharacter.relationships || character_data.relationships),
        pose_references: ensureArray(updatedCharacter.pose_references || character_data.pose_references),
        visual_reference_prompt: updatedCharacter.visual_reference_prompt || character_data.visual_reference_prompt || null,
        image_url: updatedCharacter.image_url || character_data.image_url || null,
        image_generation_prompt: updatedCharacter.image_generation_prompt || character_data.image_generation_prompt || null,
        resolution: updatedCharacter.resolution || character_data.resolution || null,
        visual_style: updatedCharacter.visual_style || character_data.visual_style || null,
        art_setting: updatedCharacter.art_setting || character_data.art_setting || null,
      };
      // 如果已存在，更新；否则插入
      if (existingChar) {
        const { data: updatedData, error: upsertError } = await supabase
          .from("anim_characters")
          .update(characterRecord)
          .eq("id", existingChar.id)
          .select();

        if (upsertError) {
          // 不返回错误，因为 anim_story_outlines 已经更新成功
        } else {
        }
      } else {
        const { data: insertedData, error: insertError } = await supabase
          .from("anim_characters")
          .insert(characterRecord)
          .select();

        if (insertError) {
          // 不返回错误，因为 anim_story_outlines 已经更新成功
        } else {
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        character: characters[characterIndex],
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

