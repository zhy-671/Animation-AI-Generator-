import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * API Route: 根据故事章节生成场次列表
 * 调用 DashScope Chat Completions API 生成结构化的场次列表
 * 
 * 注意：此接口只生成场次信息（文本描述、镜头语言等），不生成分镜图片
 * 后续会根据场次再生成对应的分镜（图片、视频等视觉内容）
 */
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
    console.log("=== 生成场次API - 接收到的参数 ===");
    console.log("project_id:", project_id);
    console.log("story_chapters数量:", story_chapters?.length || 0);
    console.log("story_chapters结构:", story_chapters?.map((ch: any) => ({
      chapter_number: ch.chapter_number,
      chapter_title: ch.chapter_title,
      chapter_summary_length: ch.chapter_summary?.length || 0,
      chapter_summary_preview: ch.chapter_summary?.substring(0, 100) || "",
    })));
    console.log("================================");

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

    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      console.error("DASHSCOPE_API_KEY is not configured in environment variables");
      return NextResponse.json(
        { success: false, error: "DASHSCOPE_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // 构建提示词 - 使用国际标准的场次生成系统提示词
    const systemPrompt = `LANGUAGE REQUIREMENT: Respond only in English. Never use Chinese or any other language in your responses.

You are a professional anime screenwriter specializing in international anime production with expertise in:
- Cinematic narrative structure and pacing for global audiences
- Animation production pipeline and technical requirements
- Visual storytelling and scene construction
- Character development and emotional storytelling

【International Standards】
1. **1:1 Mapping**: Each chapter = one core scene with precise correspondence
2. **Visual-First**: All descriptions optimized for storyboard production and animation
3. **Runtime Control**: Each scene 120-180 seconds animation runtime
4. **Emotional Arc**: Clear dramatic tension and character development between scenes
5. **Production-Oriented**: Consider international animation pipeline feasibility and costs
6. **Global Appeal**: Universal themes with cross-cultural resonance

【Industry Terminology】
Apply: dramatic conflict, emotional arc, visual metaphor, pacing control, character development, cinematographic language, runtime specifications, production notes

【Standardized JSON Output】

Output format (must match exactly):

[
  {
    "scene": "{chapter_number}: {chapter_title}",
    "scene_time": "{Detailed Time with Weather/Lighting, e.g., Night, Day, Evening}",
    "scene_location": "{Interior/Exterior + Environmental Description, e.g., Exterior · Ghost Reef Sea}",
    "main_characters": [
      {
        "name": "{character_name}",
        "emotional_state": "{current mood, tension level, inner thoughts based on actual chapter content}"
      }
    ],
    "scene_description": "**CRITICAL**: Generate 1–2 sentences that accurately describe and represent the chapter's content. The description MUST be based on the actual chapter content, capturing key plot points, character actions, environmental details, atmosphere, emotional tone, and visual elements central to the chapter's story.",
    "scene_story": "**CRITICAL**: You MUST use the COMPLETE ORIGINAL chapter text from the story content EXACTLY as provided. DO NOT summarize, rewrite, or edit the chapter text. Copy it verbatim. The scene_story field must contain the FULL, UNMODIFIED chapter content.",
    "key_visual_cues": {
      "shot_1": "{Wide shot/Medium shot/Close-up, describe action, characters, or visual elements}",
      "shot_2": "{Action or expression close-up}",
      "shot_3": "{Environment, lighting, weather, interactive props and other visual elements}"
    }
  }
]

【Quality Standards】
- Scene titles (scene) reflect core dramatic conflict (8-12 words)
- Time settings (scene_time) support narrative development and atmosphere with weather/lighting details
- Location descriptions (scene_location) include environmental details suitable for visual storytelling
- Character emotional states (emotional_state) reflect inner feelings based on actual chapter events
- Scene descriptions (scene_description) accurately represent chapter content, not generic descriptions
- Story content (scene_story) maintains source fidelity - MUST be exact, complete, unmodified original chapter text
- Visual cues (key_visual_cues) consider international animation production standards

【Global Market Optimization】
- Universal themes with cultural sensitivity
- Visual storytelling suitable for subtitled/dubbed content
- Commercial appeal for international streaming platforms
- Merchandising opportunities for global markets

【Professional Conversion】
Convert the following chapter-structured content into international-standard JSON anime scenes.

**CRITICAL REQUIREMENTS:**
1. **scene_description MUST accurately represent the chapter's content**: Analyze the complete chapter text and create a description that accurately represents what happens in the chapter, including key plot points, character actions, environmental details, and narrative developments.
2. **scene_story MUST be the EXACT, COMPLETE, UNMODIFIED original chapter text from the story content. DO NOT summarize or rewrite it.**
3. One scene per chapter with precise 1:1 mapping.
4. Key visual cues must be sufficient for storyboard or AI scene generation and must be derived from the actual chapter content.
5. Characters' emotional states must reflect the narrative tension and inner feelings as described in the chapter.
6. Scene descriptions should include lighting, weather, sound, and atmosphere cues, all extracted from the chapter's actual content.`;

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
    
    console.log("=== 提取章节完整文本 ===");
    console.log("故事文本总长度:", storyScript.content?.length || 0);
    console.log("章节数量:", chapters.length);
    
    if (storyScript.content) {
      const content = storyScript.content;
      const sortedChapters = chapters.sort((a: any, b: any) => a.chapter_number - b.chapter_number);
      
      sortedChapters.forEach((chapter: any, index: number) => {
        const chapterNumber = chapter.chapter_number;
        const chapterTitle = chapter.chapter_title || "";
        
        console.log(`\n处理章节 ${chapterNumber}: ${chapterTitle}`);
        
        // 尝试多种匹配模式
        const patterns = [
          // 模式1: 第X章 或 第X节
          new RegExp(`第\\s*${chapterNumber}\\s*[章节节]`, 'i'),
          // 模式2: 章节标题
          chapterTitle ? new RegExp(chapterTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null,
          // 模式3: ## 章节标题 或 # 章节标题
          chapterTitle ? new RegExp(`#+\\s*${chapterTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') : null,
        ].filter(Boolean) as RegExp[];
        
        console.log("匹配模式:", patterns.map(p => p.toString()));
        
        let titleMatch = -1;
        for (const pattern of patterns) {
          const match = content.search(pattern);
          if (match >= 0) {
            titleMatch = match;
            console.log(`✅ 找到匹配位置: ${match}, 模式: ${pattern.toString()}`);
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
            console.log(`下一个章节开始位置: ${nextChapterStart}`);
          }
          
          // 提取章节完整文本（从标题开始到下一个章节或内容结尾）
          const chapterText = content.substring(titleMatch, nextChapterStart).trim();
          console.log(`提取的文本长度: ${chapterText.length}`);
          console.log(`提取的文本预览（前200字符）: ${chapterText.substring(0, 200)}`);
          
          // 移除标题行（如果存在）
          const lines = chapterText.split('\n');
          const firstLine = lines[0] || '';
          // 如果第一行看起来像标题（包含章节号或章节标题），跳过它
          if (firstLine.match(/第\s*\d+\s*[章节节]/i) || (chapterTitle && firstLine.includes(chapterTitle))) {
            fullChapterTexts[chapterNumber] = lines.slice(1).join('\n').trim();
            console.log(`移除标题行后长度: ${fullChapterTexts[chapterNumber].length}`);
          } else {
            fullChapterTexts[chapterNumber] = chapterText;
            console.log(`保留完整文本（未移除标题行）`);
          }
        } else {
          console.log(`⚠️ 未找到章节标题，使用平均分割`);
          // 如果找不到标题，尝试按章节数量平均分割内容
          if (sortedChapters.length > 1) {
            const avgLength = content.length / sortedChapters.length;
            const startPos = Math.floor(avgLength * index);
            const endPos = index < sortedChapters.length - 1 ? Math.floor(avgLength * (index + 1)) : content.length;
            fullChapterTexts[chapterNumber] = content.substring(startPos, endPos).trim();
            console.log(`平均分割: ${startPos} - ${endPos}, 长度: ${fullChapterTexts[chapterNumber].length}`);
          } else {
            // 只有一个章节，使用整个内容
            fullChapterTexts[chapterNumber] = content;
            console.log(`使用完整内容`);
          }
        }
      });
    }
    
    console.log("\n=== 提取结果汇总 ===");
    Object.keys(fullChapterTexts).forEach(key => {
      const num = parseInt(key);
      console.log(`章节 ${num}: ${fullChapterTexts[num].length} 字符`);
    });
    console.log("================================");

    // 打印项目内容和传递给AI的信息
    console.log("=== 生成场次API - 项目内容信息 ===");
    console.log("项目ID:", project_id);
    console.log("项目标题:", project.title);
    console.log("故事文本长度:", storyScript.content?.length || 0);
    console.log("故事文本预览（前500字符）:", storyScript.content?.substring(0, 500) || "");
    console.log("故事文本预览（后500字符）:", storyScript.content?.substring(Math.max(0, (storyScript.content?.length || 0) - 500)) || "");
    console.log("章节数量:", chapters?.length || 0);
    console.log("================================");

    // 构建用户提示词，直接传递完整的原始剧本内容
    const userPrompt = `COMPLETE ORIGINAL STORY CONTENT:

${storyScript.content || ""}

---

CHAPTER STRUCTURE (for reference only):

${JSON.stringify(chapters.map((ch: any) => ({
  chapter_number: ch.chapter_number,
  chapter_title: ch.chapter_title,
  chapter_summary: ch.chapter_summary,
})), null, 2)}

---

**IMPORTANT INSTRUCTIONS:**

1. Analyze the COMPLETE ORIGINAL STORY CONTENT above (not just the chapter summaries).

2. For each chapter in the chapter structure, generate ONE scene with:
   - scene: {chapter_number}: {chapter_title}
   - scene_time: Extract from the original story content
   - scene_location: Extract from the original story content
   - main_characters: Extract characters and their emotional states from the original story content
   - **scene_description: CRITICAL - Generate 1-2 sentences that accurately describe and represent the chapter's actual content. You MUST analyze the complete chapter text and extract:**
     * Key plot points and events that occur in this chapter
     * Character actions, interactions, and developments
     * Environmental details, atmosphere, and mood
     * Emotional tone and narrative tension
     * Visual elements and scenes central to the chapter
     The description must enable understanding of what happens in this chapter and how it contributes to the story. It must reflect the chapter's actual content, not generic descriptions.
   - **scene_story: MUST be the EXACT, COMPLETE text from the original story content for this chapter. DO NOT summarize or rewrite.**
   - key_visual_cues: Generate visual cues based on the actual scenes and events described in the original story content

3. The scene_story field MUST contain the COMPLETE, UNMODIFIED chapter text from the original story content above.

4. **IMPORTANT**: The scene_description must be generated by carefully reading and analyzing the actual chapter content. It should describe what actually happens in the chapter, including specific events, character developments, and narrative progression. Do not use generic or placeholder descriptions.

Please generate the complete scene list according to the instructions above. Each chapter should correspond to exactly one scene.`;

    // 打印传递给AI的提示词长度
    console.log("=== 生成场次API - 传递给AI的提示词 ===");
    console.log("提示词长度:", userPrompt.length);
    console.log("提示词预览（前1000字符）:", userPrompt.substring(0, 1000));
    console.log("================================");

    // 调用 DashScope Chat Completions API
    const response = await fetch(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "qwen-plus",
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
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DashScope API error:", response.status, errorText);
      return NextResponse.json(
        {
          success: false,
          error: `DashScope API error: ${response.status} - ${errorText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
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
      console.error("JSON parse error:", parseError);
      console.error("Raw content:", rawContent.substring(0, 500));
      
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
        console.error("Error updating scene:", updateError);
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
        console.error("Error deleting old scene items:", deleteError);
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
        console.error("Error creating scene:", insertError);
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
      console.log(`=== Scene ${sceneNumber} - Scene Story Processing ===`);
      console.log("AI returned scene_story length:", scene.scene_story?.length || scene.场次故事?.length || 0);
      console.log("AI returned scene_story preview:", (scene.scene_story || scene.场次故事)?.substring(0, 200) || "");
      console.log("Extracted full chapter text length:", fullChapterTexts[sceneNumber]?.length || 0);
      console.log("Extracted full chapter text preview:", fullChapterTexts[sceneNumber]?.substring(0, 200) || "");
      console.log("Original chapter summary length:", originalChapter?.chapter_summary?.length || 0);
      console.log("Original chapter summary preview:", originalChapter?.chapter_summary?.substring(0, 200) || "");
      
      // Prioritize using the complete chapter text extracted from project content
      if (fullChapterTexts[sceneNumber] && fullChapterTexts[sceneNumber].length > 50) {
        sceneStory = fullChapterTexts[sceneNumber];
        console.log("✅ Using: Extracted complete chapter text");
      } 
      // If AI returned scene_story is long (likely complete text), use it
      else if ((scene.scene_story || scene.场次故事) && (scene.scene_story || scene.场次故事).length > 200) {
        sceneStory = scene.scene_story || scene.场次故事;
        console.log("✅ Using: AI returned long text");
      }
      // Otherwise use chapter summary as fallback
      else if (originalChapter?.chapter_summary) {
        sceneStory = originalChapter.chapter_summary;
        console.log("⚠️ Using: Chapter summary (may be incomplete)");
      }
      // Finally use AI returned content (even if short)
      else {
        sceneStory = scene.scene_story || scene.场次故事 || null;
        console.log("⚠️ Using: AI returned content (may be short)");
      }
      console.log("Final scene_story length:", sceneStory?.length || 0);
      console.log("Final scene_story preview:", sceneStory?.substring(0, 200) || "");
      console.log("================================");
      
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
      console.error("Error creating scene items:", itemsError);
      return NextResponse.json(
        { success: false, error: `Failed to create scene items: ${itemsError.message}` },
        { status: 500 }
      );
    }

    // 更新项目的分镜步骤状态为完成
    const { error: statusError } = await supabase
      .from("anim_storyboard_projects")
      .update({ status_storyboard: true })
      .eq("id", project_id)
      .eq("user_id", user.id);

    if (statusError) {
      console.error("Error updating storyboard status:", statusError);
      // 不返回错误，因为场次已经创建成功
    }

    return NextResponse.json({
      success: true,
      data: {
        scene_id: sceneId,
        scenes: scenesArray,
      },
    });
  } catch (error) {
    console.error("Error generating scenes:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

