import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * API Route: 根据故事章节生成场次列表
 * 调用 DashScope Chat Completions API 生成结构化的场次列表
 * 
 * 注意：此接口只生成场次信息（文本描述、镜头语言等），不生成分镜图片
 * 后续会根据场次再生成对应的分镜（图片、视频等视觉内容）
 */

// 设置最大执行时间为 300 秒（5 分钟），因为生成场次可能需要较长时间
export const maxDuration = 300;

export async function POST(request: NextRequest) {
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
    const { project_id, story_chapters } = body;

    // 打印接收到的参数
    if (!project_id) {
      return NextResponse.json(
        { success: false, error: "project_id is required" },
        { status: 400 }
      );
    }

    if (!story_chapters || !Array.isArray(story_chapters) || story_chapters.length === 0) {
      return NextResponse.json(
        { success: false, error: "story_chapters is required and must be a non-empty array" },
        { status: 400 }
      );
    }

    // ========== 原来的 DashScope API 调用（已注释） ==========
    // const apiKey = process.env.DASHSCOPE_API_KEY;
    // if (!apiKey) {
    //   return NextResponse.json(
    //     { success: false, error: "DASHSCOPE_API_KEY is not configured" },
    //     { status: 500 }
    //   );
    // }

    // ========== 新的豆包 API 调用 ==========
    // 使用火山引擎 API Key（支持 VOLCANO_API_KEY 或 ARK_API_KEY）
    const apiKey = process.env.VOLCANO_API_KEY || process.env.ARK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "VOLCANO_API_KEY or ARK_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // 构建提示词 - 使用国际标准的场次生成系统提示词
    const systemPrompt = `LANGUAGE REQUIREMENT: Respond only in English.

You are a professional cinematic scene expert specializing in international/Western environments, object consistency, and animation-ready worldbuilding.

Task:

Convert the provided chapter-structured novel into **animation-ready scene JSONs**, focusing on environments, props, buildings, and atmosphere. Each chapter corresponds to **one scene**. Do NOT generate shots, camera angles, or storyboards; only generate scene-level information.

Scene Requirements:

1. Scene-level fields:
   - scene: "{chapter_number}: {chapter_title}"
   - scene_time: "{Time, Weather, Lighting, e.g., Night, Rainy Evening}"
   - scene_location: "{Interior/Exterior + detailed environmental description including buildings, streets, nature, architecture, and visible objects}"
   - scene_description: 1–2 sentences accurately describing the chapter's environment, mood, atmosphere, and visual elements
   - scene_story: **The full original chapter text, unmodified**
   - scene_elements: List all **visible objects, props, vehicles, furniture, animals, and buildings** mentioned or implied. Include relative positions if possible. These elements should be persistent across scenes unless the environment changes.

Critical Instructions:
1. Focus **only on environments, props, buildings, weather, lighting, and atmosphere**.
2. Do **NOT include characters, dialogues, or actions**.
3. Ensure scene_elements are **complete, specific, and animation-ready**, suitable for later splitting into shots.
4. JSON output must be **valid and parsable**.

Example JSON Output:

[
  {
    "scene": "1: Foggy Harbor",
    "scene_time": "Night, foggy, cold wind",
    "scene_location": "Exterior · Harbor coastline, misty water, docked ships, wooden piers, distant lighthouse, warehouses, crates stacked along the dock",
    "scene_description": "The harbor is enveloped in fog, with ships quietly rocking by the piers. Lanterns flicker on the docks, and waves lap against the wooden piers.",
    "scene_story": "Full original chapter text here...",
    "scene_elements": [
      "Docked ships with sails furled",
      "Wooden piers and walkways",
      "Lanterns on the dock",
      "Crates and barrels stacked along the pier",
      "Distant lighthouse",
      "Fog and mist over the water",
      "Waves gently hitting the piers"
    ]
  }
]`;

    // 获取项目信息
    const { data: project, error: projectError } = await supabase
      .from("anim_storyboard_projects")
      .select("id, title")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    // 从新表获取完整的故事文本
    const { data: storyScript, error: scriptError } = await supabase
      .from("anim_story_scripts")
      .select("content")
      .eq("project_id", project_id)
      .single();

    if (scriptError || !storyScript) {
      return NextResponse.json(
        { success: false, error: "Story script not found" },
        { status: 404 }
      );
    }

    // 从新表获取故事大纲和章节信息
    const { data: storyOutline, error: outlineError } = await supabase
      .from("anim_story_outlines")
      .select("story_outline")
      .eq("project_id", project_id)
      .single();

    if (outlineError || !storyOutline) {
      return NextResponse.json(
        { success: false, error: "Story outline not found" },
        { status: 404 }
      );
    }

    // 提取章节信息
    const outlineData = storyOutline.story_outline;
    const chapters = outlineData?.chapters || story_chapters;

    // 从项目内容中提取每个章节的完整文本
    // 尝试多种方式匹配章节：章节号、章节标题等
    let fullChapterTexts: Record<number, string> = {};
    // 对章节进行排序，确保按章节号顺序处理
    const sortedChapters = [...chapters].sort((a: any, b: any) => a.chapter_number - b.chapter_number);
    
    if (storyScript.content) {
      const content = storyScript.content;
      
      sortedChapters.forEach((chapter: any, index: number) => {
        const chapterNumber = chapter.chapter_number;
        const chapterTitle = chapter.chapter_title || "";
        // 尝试多种匹配模式
        const patterns = [
          // 模式1: 第X章 或 第X节
          new RegExp(`第\\s*${chapterNumber}\\s*[章节节]`, 'i'),
          // 模式2: 章节标题
          chapterTitle ? new RegExp(chapterTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null,
          // 模式3: ## 章节标题 或 # 章节标题
          chapterTitle ? new RegExp(`#+\\s*${chapterTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') : null,
        ].filter(Boolean) as RegExp[];
        let titleMatch = -1;
        for (const pattern of patterns) {
          const match = content.search(pattern);
          if (match >= 0) {
            titleMatch = match;
            break;
          }
        }
        
        if (titleMatch >= 0) {
          // 找到下一个章节的开始位置
          let nextChapterStart = content.length;
          
          // 查找下一个章节
          if (index < sortedChapters.length - 1) {
            const nextChapter = sortedChapters[index + 1];
            const nextPatterns = [
              new RegExp(`第\\s*${nextChapter.chapter_number}\\s*[章节节]`, 'i'),
              nextChapter.chapter_title ? new RegExp(nextChapter.chapter_title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null,
              nextChapter.chapter_title ? new RegExp(`#+\\s*${nextChapter.chapter_title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') : null,
            ].filter(Boolean) as RegExp[];
            
            for (const pattern of nextPatterns) {
              const nextMatch = content.search(pattern);
              if (nextMatch > titleMatch) {
                nextChapterStart = Math.min(nextChapterStart, nextMatch);
              }
            }
          }
          
          // 提取章节完整文本（从标题开始到下一个章节或内容结尾）
          const chapterText = content.substring(titleMatch, nextChapterStart).trim();
          // 移除标题行（如果存在）
          const lines = chapterText.split('\n');
          const firstLine = lines[0] || '';
          // 如果第一行看起来像标题（包含章节号或章节标题），跳过它
          if (firstLine.match(/第\s*\d+\s*[章节节]/i) || (chapterTitle && firstLine.includes(chapterTitle))) {
            fullChapterTexts[chapterNumber] = lines.slice(1).join('\n').trim();
          } else {
            fullChapterTexts[chapterNumber] = chapterText;
          }
        } else {
          // 如果找不到标题，尝试按章节数量平均分割内容
          if (sortedChapters.length > 1) {
            const avgLength = content.length / sortedChapters.length;
            const startPos = Math.floor(avgLength * index);
            const endPos = index < sortedChapters.length - 1 ? Math.floor(avgLength * (index + 1)) : content.length;
            fullChapterTexts[chapterNumber] = content.substring(startPos, endPos).trim();
          } else {
            // 只有一个章节，使用整个内容
            fullChapterTexts[chapterNumber] = content;
          }
        }
      });
    }
    Object.keys(fullChapterTexts).forEach(key => {
      const num = parseInt(key);
    });
    
    // 构建章节信息字符串，明确告诉AI有多少个章节
    let chaptersInfo = `There are ${sortedChapters.length} chapters in total. Each chapter must generate exactly one scene.\n\n`;
    
    sortedChapters.forEach((chapter: any) => {
      const chapterNumber = chapter.chapter_number;
      const chapterTitle = chapter.chapter_title || `Chapter ${chapterNumber}`;
      const chapterText = fullChapterTexts[chapterNumber] || chapter.chapter_summary || "";
      
      chaptersInfo += `Chapter ${chapterNumber}: ${chapterTitle}\n`;
      if (chapterText) {
        chaptersInfo += `Content: ${chapterText.substring(0, 500)}${chapterText.length > 500 ? '...' : ''}\n\n`;
      }
    });
    
    // 构建用户提示词，明确传递章节信息和完整内容
    const userPrompt = `Input Novel Chapters Information:

${chaptersInfo}

Full Story Content:

"""
${storyScript.content || ""}
"""

IMPORTANT: You must generate exactly ${sortedChapters.length} scenes, one for each chapter. The scene number in the "scene" field must match the chapter number (e.g., "1: Chapter Title" for Chapter 1, "2: Chapter Title" for Chapter 2, etc.).

Please generate animation-ready scene JSONs for each chapter. Focus only on environments, props, buildings, weather, lighting, and atmosphere. Do NOT include characters, dialogues, or actions. Each chapter should correspond to exactly one scene.`;

    // 打印传递给AI的提示词长度
    // ========== 原来的 DashScope API 调用（已注释） ==========
    // const response = await fetch(
    //   "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    //   {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //       Authorization: `Bearer ${apiKey}`,
    //     },
    //     body: JSON.stringify({
    //       model: "qwen-plus",
    //       messages: [
    //         {
    //           role: "system",
    //           content: systemPrompt,
    //         },
    //         {
    //           role: "user",
    //           content: userPrompt,
    //         },
    //       ],
    //       temperature: 0.7,
    //       max_tokens: 8000,
    //     }),
    //   }
    // );

    // if (!response.ok) {
    //   const errorText = await response.text();
    //   return NextResponse.json(
    //     {
    //       success: false,
    //       error: `DashScope API error: ${response.status} - ${errorText}`,
    //     },
    //     { status: response.status }
    //   );
    // }

    // const data = await response.json();
    // const rawContent = data.choices?.[0]?.message?.content || "";

    // ========== 新的豆包 API 调用 ==========
    // 构建请求参数（使用 doubao API 格式）
    const requestBody = {
      model: "doubao-seed-1-6-251015",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 8000,
    };

    // 调用 doubao Chat Completions API
    const response = await fetch(
      "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = `HTTP ${response.status} ${response.statusText}`;
      }
      
      // 如果是 401 错误，提供更详细的错误信息
      if (response.status === 401) {
        return NextResponse.json(
          {
            success: false,
            error: "API key authentication failed. Please check your VOLCANO_API_KEY or ARK_API_KEY environment variable.",
            details: errorText,
          },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        {
          success: false,
          error: `Doubao API error: ${response.status}. ${errorText.substring(0, 200)}`,
        },
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid response from AI service. Please try again.",
        },
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // 提取返回内容（doubao API 返回格式与 OpenAI 兼容）
    const rawContent = data.choices?.[0]?.message?.content || "";

    if (!rawContent) {
      return NextResponse.json(
        { success: false, error: "No content returned from API" },
        { status: 500 }
      );
    }

    // 清理和解析JSON
    let cleanedContent = rawContent.trim();
    
    // 移除markdown代码块标记
    if (cleanedContent.startsWith("```")) {
      const lines = cleanedContent.split("\n");
      if (lines[0].includes("json")) {
        lines.shift(); // 移除第一行
      }
      lines.pop(); // 移除最后一行（```）
      cleanedContent = lines.join("\n").trim();
    }

    // 移除markdown代码块结束标记
    cleanedContent = cleanedContent.replace(/```json\s*/g, "").replace(/```\s*/g, "");

    // 尝试解析JSON
    let parsedData: any;
    try {
      parsedData = JSON.parse(cleanedContent);
    } catch (parseError) {
      // 尝试提取JSON对象
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedData = JSON.parse(jsonMatch[0]);
        } catch (e) {
          return NextResponse.json(
            { success: false, error: `Failed to parse JSON: ${e instanceof Error ? e.message : String(e)}` },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, error: "No valid JSON found in response" },
          { status: 500 }
        );
      }
    }

    // 验证数据结构 - 新格式：直接是数组，或者包含 scenes 字段
    let scenesArray: any[] = [];
    if (Array.isArray(parsedData)) {
      scenesArray = parsedData;
    } else if (parsedData.scenes && Array.isArray(parsedData.scenes)) {
      scenesArray = parsedData.scenes;
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid response structure: scenes array is missing" },
        { status: 500 }
      );
    }

    // 检查是否已存在分镜（通过project_id列）
    const { data: existingScene, error: sceneCheckError } = await supabase
      .from("anim_scenes")
      .select("id")
      .eq("user_id", user.id)
      .eq("project_id", project_id)
      .maybeSingle();

    let sceneId: string;

    if (existingScene && existingScene.id) {
      // 更新现有分镜
      sceneId = existingScene.id;
      
      const { error: updateError } = await supabase
        .from("anim_scenes")
        .update({
          title: project.title,
          summary: storyScript.content?.substring(0, 500) || "",
          project_id: project_id,
          updated_at: new Date().toISOString(),
          metadata: {
            ...parsedData,
          },
        })
        .eq("id", sceneId);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: `Failed to update scene: ${updateError.message}` },
          { status: 500 }
        );
      }

      // 删除旧的场次项
      const { error: deleteError } = await supabase
        .from("anim_scene_items")
        .delete()
        .eq("scene_id", sceneId);

      if (deleteError) {
      }
    } else {
      // 创建新场次
      const { data: newScene, error: insertError } = await supabase
        .from("anim_scenes")
        .insert({
          user_id: user.id,
          title: project.title,
          summary: storyScript.content?.substring(0, 500) || "", // 使用故事文本的前500字符作为摘要
          project_id: project_id, // 直接使用 project_id 列
          metadata: {
            ...parsedData,
          },
        })
        .select()
        .single();

      if (insertError || !newScene) {
        return NextResponse.json(
          { success: false, error: `Failed to create scene: ${insertError?.message || "Unknown error"}` },
          { status: 500 }
        );
      }

      sceneId = newScene.id;
    }

    // 创建场次项（新格式：每个章节对应一个场次）
    // 注意：image_url 初始为 null，后续会根据场次生成分镜图片
    const sceneItems = scenesArray.map((scene: any, index: number) => {
      // Extract chapter number from scene string (e.g., "1: Secret Under the Reef" -> 1)
      // Support both old Chinese format and new English format
      const sceneMatch = scene.scene?.match(/^(\d+)[：:]/) || scene.场次?.match(/^(\d+)[：:]/);
      const sceneNumber = sceneMatch ? parseInt(sceneMatch[1]) : (index + 1);
      
      // Extract title from scene string (e.g., "1: Secret Under the Reef" -> "Secret Under the Reef")
      // Support both old Chinese format and new English format
      const sceneTitle = scene.scene?.split(/[：:]/)[1]?.trim() || 
                        scene.场次?.split(/[：:]/)[1]?.trim() || 
                        scene.scene || 
                        scene.场次 || 
                        `Scene ${sceneNumber}`;
      
      // Prioritize using the complete original chapter text to ensure scene_story is complete
      const originalChapter = chapters.find((ch: any) => ch.chapter_number === sceneNumber);
      let sceneStory = null;
      
      // Debug logging
      // Prioritize using the complete chapter text extracted from project content
      if (fullChapterTexts[sceneNumber] && fullChapterTexts[sceneNumber].length > 50) {
        sceneStory = fullChapterTexts[sceneNumber];
      } 
      // If AI returned scene_story is long (likely complete text), use it
      else if ((scene.scene_story || scene.场次故事) && (scene.scene_story || scene.场次故事).length > 200) {
        sceneStory = scene.scene_story || scene.场次故事;
      }
      // Otherwise use chapter summary as fallback
      else if (originalChapter?.chapter_summary) {
        sceneStory = originalChapter.chapter_summary;
      }
      // Finally use AI returned content (even if short)
      else {
        sceneStory = scene.scene_story || scene.场次故事 || null;
      }
      return {
        scene_id: sceneId,
        scene_number: sceneNumber,
        text: scene.scene_description || scene.场次描述 || scene.text || "",
        scene_detail: (scene.key_visual_cues || scene.关键画面提示) ? JSON.stringify(scene.key_visual_cues || scene.关键画面提示) : (scene.scene_detail || null),
        metadata: {
          scene_title: sceneTitle,
          scene_time: scene.scene_time || scene.场次时间 || null,
          scene_location: scene.scene_location || scene.场次地点 || null,
          main_characters: scene.main_characters || scene.主要角色 || [],
          scene_story: sceneStory || null,
          key_visual_cues: scene.key_visual_cues || scene.关键画面提示 || null,
          camera: scene.camera || null,
          dialogue: scene.dialogue || [],
          scene_duration: scene.scene_duration || null,
        },
        image_url: null, // Scene stage does not generate images, will be updated during storyboard generation
        video_url: null, // Scene stage does not generate videos, will be updated during video generation
      };
    });

    const { error: itemsError } = await supabase
      .from("anim_scene_items")
      .insert(sceneItems);

    if (itemsError) {
      return NextResponse.json(
        { success: false, error: `Failed to create scene items: ${itemsError.message}` },
        { status: 500 }
      );
    }

    // 更新项目的分镜步骤状态为完成（旧表，保持兼容）
    const { error: statusError } = await supabase
      .from("anim_storyboard_projects")
      .update({ status_storyboard: true })
      .eq("id", project_id)
      .eq("user_id", user.id);

    if (statusError) {
      // 不返回错误，因为场次已经创建成功
    }

    // 注意：step_storyboard 状态只在视频生成成功后才更新，这里不更新

    return NextResponse.json({
      success: true,
      data: {
        scene_id: sceneId,
        scenes: scenesArray,
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

