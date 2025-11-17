import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * DELETE /api/storyboard/projects/[id]
 * 删除指定的故事剧本项目
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 删除项目（RLS会自动确保用户只能删除自己的项目）
    const { error: deleteError } = await supabase
      .from("anim_storyboard_projects")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id); // 双重检查确保安全

    if (deleteError) {
      console.error("Error deleting project:", deleteError);
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete project" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error in DELETE /api/storyboard/projects/[id]:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete project",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/storyboard/projects/[id]
 * 获取指定的故事剧本项目
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 获取项目主表（RLS会自动确保用户只能查看自己的项目）
    const { data: project, error: fetchError } = await supabase
      .from("anim_storyboard_projects")
      .select("id, title, art_setting, visual_style, created_at, updated_at, status_script, status_settings, status_storyboard, status_video")
      .eq("id", id)
      .eq("user_id", user.id) // 双重检查确保安全
      .single();

    if (fetchError) {
      console.error("Error fetching project:", fetchError);
      
      // PGRST116 错误表示查询结果为空（0行），应该返回 404 而不是 500
      if (fetchError.code === 'PGRST116' || fetchError.message?.includes('0 rows')) {
        return NextResponse.json(
          { 
            success: false,
            error: "Project not found" 
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: fetchError.message || "Failed to fetch project" 
        },
        { status: 500 }
      );
    }

    if (!project) {
      return NextResponse.json(
        { 
          success: false,
          error: "Project not found" 
        },
        { status: 404 }
      );
    }

    // 从新表获取故事剧本
    const { data: storyScript, error: scriptError } = await supabase
      .from("anim_story_scripts")
      .select("title, content")
      .eq("project_id", id)
      .maybeSingle(); // 使用 maybeSingle 而不是 single，避免找不到数据时报错

    if (scriptError) {
      console.error("Error fetching story script:", scriptError);
    } else {
      console.log("=== GET /api/storyboard/projects/[id] - 故事剧本数据 ===");
      console.log("storyScript exists:", !!storyScript);
      console.log("storyScript content length:", storyScript?.content?.length || 0);
      console.log("storyScript content preview:", storyScript?.content?.substring(0, 200) || "");
    }

    // 从新表获取故事大纲和角色信息
    const { data: storyOutline, error: outlineError } = await supabase
      .from("anim_story_outlines")
      .select("story_outline, characters")
      .eq("project_id", id)
      .maybeSingle(); // 使用 maybeSingle 而不是 single，避免找不到数据时报错

    if (outlineError) {
      console.error("Error fetching story outline:", outlineError);
    } else {
      console.log("=== GET /api/storyboard/projects/[id] - 故事大纲数据 ===");
      console.log("storyOutline exists:", !!storyOutline);
      if (storyOutline) {
        console.log("storyOutline.story_outline type:", typeof storyOutline.story_outline);
        console.log("storyOutline.story_outline keys:", storyOutline.story_outline ? Object.keys(storyOutline.story_outline) : "null");
        console.log("storyOutline.story_outline.theme:", storyOutline.story_outline?.theme);
        console.log("storyOutline.story_outline.summary:", storyOutline.story_outline?.summary?.substring(0, 100));
        console.log("storyOutline.story_outline.chapters:", storyOutline.story_outline?.chapters ? `exists (${storyOutline.story_outline.chapters.length} items)` : "null");
        console.log("storyOutline.characters:", storyOutline.characters ? `exists (${storyOutline.characters.length} items)` : "null");
        if (storyOutline.characters && Array.isArray(storyOutline.characters)) {
          console.log("characters preview:", storyOutline.characters.slice(0, 2).map((c: any) => ({
            id: c.id,
            name: c.name,
            age: c.age,
            gender: c.gender,
            hasAppearance: !!c.appearance,
            appearanceType: typeof c.appearance,
            hasClothingStyle: !!c.clothing_style,
            clothingStyleType: typeof c.clothing_style,
            allKeys: Object.keys(c),
          })));
          // 打印第一个角色的完整数据用于调试
          if (storyOutline.characters.length > 0) {
            console.log("第一个角色的完整数据:", storyOutline.characters[0]);
          }
        }
      }
    }

    // 合并数据，保持向后兼容
    // 注意：storyOutline.story_outline 包含 theme, summary, chapters 等
    // storyOutline.characters 是单独的角色信息数组（可能只包含 name, image_url）
    // 重要：如果 story_outline 中原本包含完整的角色信息，需要检查并合并
    
    // 检查 story_outline 中是否包含完整的角色信息
    let fullCharactersData = storyOutline?.characters || [];
    let storyOutlineData = storyOutline?.story_outline || {};
    
    // 如果 story_outline 中也有 characters 字段（可能是原始AI生成的数据），优先使用
    if (storyOutlineData.characters && Array.isArray(storyOutlineData.characters)) {
      console.log("发现 story_outline.story_outline 中也包含 characters，检查是否需要合并...");
      // 检查哪个包含更完整的信息
      const sampleFromStoryOutline = storyOutlineData.characters[0];
      const sampleFromCharacters = fullCharactersData[0];
      
      const storyOutlineHasFullInfo = sampleFromStoryOutline && (
        sampleFromStoryOutline.appearance || 
        sampleFromStoryOutline.clothing_style ||
        sampleFromStoryOutline.age ||
        sampleFromStoryOutline.gender
      );
      
      const charactersHasFullInfo = sampleFromCharacters && (
        sampleFromCharacters.appearance || 
        sampleFromCharacters.clothing_style ||
        sampleFromCharacters.age ||
        sampleFromCharacters.gender
      );
      
      console.log("story_outline.characters 是否有完整信息:", storyOutlineHasFullInfo);
      console.log("characters 字段是否有完整信息:", charactersHasFullInfo);
      
      // 如果 story_outline 中的角色信息更完整，使用它，然后用 characters 字段中的图片URL补充
      if (storyOutlineHasFullInfo && !charactersHasFullInfo) {
        console.log("使用 story_outline 中的完整角色信息，并用 characters 字段中的图片URL补充");
        fullCharactersData = storyOutlineData.characters.map((char: any) => {
          const charFromSimple = fullCharactersData.find((c: any) => c.id === char.id || c.name === char.name);
          return {
            ...char, // 保留完整的角色信息
            image_url: charFromSimple?.image_url || char.image_url, // 使用简化的 characters 中的图片URL
          };
        });
      }
      
      // 移除 story_outline 中的 characters，避免重复
      const { characters: _, ...storyOutlineWithoutChars } = storyOutlineData;
      storyOutlineData = storyOutlineWithoutChars;
    }
    
    const mergedData = {
      ...project,
      // 向后兼容：content 字段从 story_scripts 表获取（完整的故事剧本文本）
      content: storyScript?.content || "",
      // 向后兼容：story_outline 字段合并 story_outline（包含theme, summary, chapters）和 characters
      story_outline: storyOutline ? {
        ...storyOutlineData, // 展开 story_outline（theme, summary, chapters等，不包含 characters）
        characters: fullCharactersData, // 使用合并后的完整角色信息
      } : null,
      // 向后兼容：character_design 字段从 story_outlines.characters 获取
      character_design: fullCharactersData.length > 0 ? JSON.stringify(fullCharactersData) : null,
    };

    console.log("=== GET /api/storyboard/projects/[id] - 合并后的数据 ===");
    console.log("mergedData.content length:", mergedData.content?.length || 0);
    console.log("mergedData.story_outline:", mergedData.story_outline ? "exists" : "null");
    if (mergedData.story_outline) {
      console.log("mergedData.story_outline keys:", Object.keys(mergedData.story_outline));
      console.log("mergedData.story_outline.theme:", mergedData.story_outline.theme);
      console.log("mergedData.story_outline.summary:", mergedData.story_outline.summary?.substring(0, 100));
      console.log("mergedData.story_outline.chapters:", mergedData.story_outline.chapters ? `exists (${mergedData.story_outline.chapters.length} items)` : "null");
      console.log("mergedData.story_outline.characters:", mergedData.story_outline.characters ? `exists (${mergedData.story_outline.characters.length} items)` : "null");
    }
    console.log("mergedData.character_design:", mergedData.character_design ? `exists (${mergedData.character_design.length} chars)` : "null");

    return NextResponse.json({
      success: true,
      data: mergedData,
    });
  } catch (error) {
    console.error("Error in GET /api/storyboard/projects/[id]:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch project",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/storyboard/projects/[id]
 * 更新指定的故事剧本项目
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { title, content, story_outline, art_setting, visual_style, character_design } = body;

    // 1. 更新项目主表
    const updateData: any = {};
    if (title !== undefined) updateData.title = title.trim();
    if (art_setting !== undefined) updateData.art_setting = art_setting;
    if (visual_style !== undefined) updateData.visual_style = visual_style;
    // 如果提供了 status_settings，更新设置步骤状态
    if (body.status_settings !== undefined) updateData.status_settings = body.status_settings;

    if (Object.keys(updateData).length > 0) {
      const { data: project, error: updateError } = await supabase
        .from("anim_storyboard_projects")
        .update(updateData)
        .eq("id", id)
        .eq("user_id", user.id) // 双重检查确保安全
        .select()
        .single();

      if (updateError) {
        console.error("Error updating project:", updateError);
        
        // PGRST116 错误表示查询结果为空（0行），项目不存在
        if (updateError.code === 'PGRST116' || updateError.message?.includes('0 rows')) {
          return NextResponse.json(
            { 
              success: false,
              error: "Project not found" 
            },
            { status: 404 }
          );
        }
        
        return NextResponse.json(
          { 
            success: false,
            error: updateError.message || "Failed to update project" 
          },
          { status: 500 }
        );
      }

      if (!project) {
        return NextResponse.json(
          { 
            success: false,
            error: "Project not found" 
          },
          { status: 404 }
        );
      }
    }

    // 2. 更新故事剧本表（如果提供了 content）
    if (content !== undefined) {
      const { error: scriptError } = await supabase
        .from("anim_story_scripts")
        .upsert({
          project_id: id,
          content: content.trim(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'project_id'
        });

      if (scriptError) {
        console.error("Error updating story script:", scriptError);
        return NextResponse.json(
          { 
            success: false,
            error: `Failed to update story script: ${scriptError.message}` 
          },
          { status: 500 }
        );
      }
    }

    // 3. 更新故事大纲表（如果提供了 story_outline 或 character_design）
    if (story_outline !== undefined || character_design !== undefined) {
      let storyOutlineData = story_outline;
      let charactersData = null;

      // 如果提供了 character_design，解析它
      if (character_design !== undefined) {
        try {
          charactersData = typeof character_design === 'string' 
            ? JSON.parse(character_design) 
            : character_design;
        } catch (e) {
          console.error("Error parsing character_design:", e);
        }
      }

      // 如果提供了 story_outline，解析它
      if (story_outline !== undefined) {
        storyOutlineData = typeof story_outline === 'string' 
          ? JSON.parse(story_outline) 
          : story_outline;
        
        // 如果 story_outline 包含 characters，提取它
        if (storyOutlineData && storyOutlineData.characters && !charactersData) {
          charactersData = storyOutlineData.characters;
          // 移除 characters 从 story_outline
          const { characters: _, ...storyOutlineWithoutChars } = storyOutlineData;
          storyOutlineData = storyOutlineWithoutChars;
        }
      }

      // 获取现有的故事大纲（如果只更新部分字段）
      if (!storyOutlineData || !charactersData) {
        const { data: existingOutline } = await supabase
          .from("anim_story_outlines")
          .select("story_outline, characters")
          .eq("project_id", id)
          .single();

        if (existingOutline) {
          if (!storyOutlineData) storyOutlineData = existingOutline.story_outline;
          if (!charactersData) charactersData = existingOutline.characters;
        }
      }

      const { error: outlineError } = await supabase
        .from("anim_story_outlines")
        .upsert({
          project_id: id,
          story_outline: storyOutlineData || {},
          characters: charactersData || [],
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'project_id'
        });

      if (outlineError) {
        console.error("Error updating story outline:", outlineError);
        return NextResponse.json(
          { 
            success: false,
            error: `Failed to update story outline: ${outlineError.message}` 
          },
          { status: 500 }
        );
      }
    }

    // 重新获取完整的项目数据
    const { data: project } = await supabase
      .from("anim_storyboard_projects")
      .select("id, title, art_setting, visual_style, created_at, updated_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    const { data: storyScript } = await supabase
      .from("anim_story_scripts")
      .select("title, content")
      .eq("project_id", id)
      .single();

    const { data: storyOutline } = await supabase
      .from("anim_story_outlines")
      .select("story_outline, characters")
      .eq("project_id", id)
      .single();

    const mergedData = {
      ...project,
      content: storyScript?.content || "",
      story_outline: storyOutline ? {
        ...storyOutline.story_outline,
        characters: storyOutline.characters || [],
      } : null,
      character_design: storyOutline?.characters ? JSON.stringify(storyOutline.characters) : null,
    };

    return NextResponse.json({
      success: true,
      data: mergedData,
    });
  } catch (error) {
    console.error("Error in PATCH /api/storyboard/projects/[id]:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update project",
      },
      { status: 500 }
    );
  }
}
