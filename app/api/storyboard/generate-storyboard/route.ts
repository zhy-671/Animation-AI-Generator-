import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { qwen2Client } from "@/lib/dashscope/qwen2";

/**
 * API Route: 生成单个场次的分镜（shots）
 * 根据场次信息和角色信息生成分镜JSON
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
    const { scene_item_id, project_id } = body;

    if (!scene_item_id || !project_id) {
      return NextResponse.json(
        { success: false, error: "scene_item_id and project_id are required" },
        { status: 400 }
      );
    }

    // 1. 获取场次信息
    const { data: sceneItem, error: sceneItemError } = await supabase
      .from("anim_scene_items")
      .select("*")
      .eq("id", scene_item_id)
      .single();

    if (sceneItemError || !sceneItem) {
      return NextResponse.json(
        { success: false, error: "Scene item not found" },
        { status: 404 }
      );
    }

    // 2. 获取项目信息（包括视觉风格、分辨率比例和角色信息）
    const { data: project, error: projectError } = await supabase
      .from("anim_storyboard_projects")
      .select("visual_style, art_setting")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    // 3. 获取角色信息
    const { data: storyOutline, error: outlineError } = await supabase
      .from("anim_story_outlines")
      .select("characters")
      .eq("project_id", project_id)
      .single();

    let characters: any[] = [];
    if (!outlineError && storyOutline?.characters) {
      characters = Array.isArray(storyOutline.characters)
        ? storyOutline.characters
        : [];
    }

    // 4. 解析场次元数据
    const metadata = sceneItem.metadata || {};
    const sceneTime = metadata.场次时间 || sceneItem.metadata?.scene_time || "";
    const sceneLocation = metadata.场次地点 || sceneItem.metadata?.scene_location || "";
    const sceneDescription = sceneItem.text || "";
    const sceneStory = metadata.场次故事 || sceneItem.metadata?.scene_story || "";
    const mainCharacters = metadata.主要角色 || [];
    const sceneNumber = sceneItem.scene_number || 1;

    // 5. 获取完整故事文本（FULL_STORY）
    const { data: storyScript, error: scriptError } = await supabase
      .from("anim_story_scripts")
      .select("content")
      .eq("project_id", project_id)
      .single();

    if (scriptError || !storyScript || !storyScript.content) {
      return NextResponse.json(
        { success: false, error: "Story script not found or empty" },
        { status: 404 }
      );
    }

    const fullStory = storyScript.content;

    // 6. 构建环境信息（ENVIRONMENT_JSON）
    let environmentInfo: any = {
      default_location: sceneLocation || "Various locations as described in story",
      default_lighting: sceneTime || "Natural lighting matching story mood",
      default_color_palette: "Consistent with visual style",
      default_weather: "As described in story",
    };

    // 7. 构建角色信息数组（用于AI提示词，包含锁定外观细节）
    const visualStyle = project.visual_style || "2d";
    const characterInfo = characters.map((char: any) => {
      // 构建角色的 style_prompt（根据视觉风格调整）
      let stylePrompt = "";
      
      if (visualStyle === "2d") {
        stylePrompt = "2D animation style, flat illustration, hand-drawn";
      } else if (visualStyle === "3d") {
        stylePrompt = "3D animation style, 3D rendered, CGI";
      } else if (visualStyle === "anime") {
        stylePrompt = "anime style, Japanese animation, cel-shaded, manga-inspired";
      } else {
        stylePrompt = "anime cinematic style";
      }

      // 组合外观和服装信息（详细的外观锁定信息）
      let appearanceDetails: any = {};
      if (typeof char.appearance === 'string') {
        appearanceDetails.description = char.appearance;
      } else if (typeof char.appearance === 'object' && char.appearance !== null) {
        appearanceDetails = {
          hair_color: char.appearance.hair_color || "",
          hair_style: char.appearance.hair_style || "",
          hair_texture: char.appearance.hair_texture || "",
          hair_length: char.appearance.hair_length || "",
          eye_color: char.appearance.eye_color || "",
          facial_structure: char.appearance.facial_features || char.appearance.facial_structure || "",
          skin_tone: char.appearance.skin_tone || "",
          height: char.appearance.height || "",
          build: char.appearance.build || "",
          beard_style: char.appearance.beard_style || "",
          beard_color: char.appearance.beard_color || "",
          beard_thickness: char.appearance.beard_thickness || "",
          beard_curvature: char.appearance.beard_curvature || "",
          beard_length_mm: char.appearance.beard_length_mm || "",
        };
      }

      let clothingDetails: any = {};
      if (typeof char.clothing_style === 'string') {
        clothingDetails.description = char.clothing_style;
      } else if (typeof char.clothing_style === 'object' && char.clothing_style !== null) {
        clothingDetails = {
          design: char.clothing_style.style || char.clothing_style.design || "",
          materials: char.clothing_style.materials || "",
          decorative_elements: char.clothing_style.decorative_elements || "",
          color_scheme: char.clothing_style.color_scheme || "",
          accessories: char.clothing_style.accessories || "",
          footwear: char.clothing_style.footwear || "",
        };
      }

      return {
        name: char.name || "",
        traits: char.personality_traits || char.personality || "",
        appearance: appearanceDetails,
        clothing: clothingDetails,
        style_prompt: stylePrompt,
      };
    });

    // 8. 获取分辨率和视觉风格
    const artSetting = project.art_setting || "16:9";
    // 将比例转换为分辨率（例如 "16:9" -> "1920x1080"）
    const resolutionMap: Record<string, string> = {
      "16:9": "1920x1080",
      "4:3": "1920x1440",
      "1:1": "1920x1920",
      "9:16": "1080x1920",
    };
    const resolution = resolutionMap[artSetting] || "1920x1080";
    
    const styleMap: Record<string, string> = {
      "2d": "2D animation",
      "3d": "3D animation",
      "anime": "Japanese anime",
      "cyberpunk": "Cyberpunk",
      "clay": "Clay animation",
      "comic": "Comic book",
      "cartoon": "Cartoon",
      "realistic": "Realistic 3D cartoon",
    };
    const visualStyleName = styleMap[visualStyle] || "2D animation";

    // 9. 构建AI提示词（新指令）
    const systemPrompt = `You are a professional anime storyboard director and cinematic visual specialist.  

Your task is to generate **storyboard shots** for the provided scene based on the full story text.  

LANGUAGE REQUIREMENT: Respond only in English.  

================ INPUT =================

Full Story Text: {FULL_STORY}  

Character Info (locked appearance): {CHARACTERS_JSON}  

Environment Info: {ENVIRONMENT_JSON}  

Visual Style: {VISUAL_STYLE} (user-selected, e.g., "2D animation", "3D animation", "Japanese anime")  

Resolution: {RESOLUTION} (user-selected, e.g., "1920x1080")  

Scene Story: {SCENE_STORY} (this scene's narrative content)

================ RULES =================

1. **Character Continuity**

   - Maintain full appearance across all shots:

     - Hair style, color, and length

     - Male characters: beard style, color, shape, and length (accurate to mm)

     - Skin tone, body proportion, clothing, accessories

   - Only emotional expressions may change; physical appearance must remain identical

2. **Environment Continuity**

   - Maintain location, lighting, color palette, props, and background elements

   - Minor environmental adjustments allowed ONLY if required by story progression

3. **Shots per Scene**

   - Generate **1–5 shots** depending on scene content

   - Each shot must contain:

     - Framing, camera angle, lens, and movement

     - Character actions, gestures, facial expressions

     - Environment description (lighting, weather, color palette, props)

     - Image Prompt (AI-optimized)

     - Video Prompt (AI-optimized)

       - **Must include continuity_reference to previous shot's video_prompt** (except the first shot)

       - Example format:

         continuity_reference: "Maintain full visual continuity with the previous shot. Use the same character appearance, beard, clothing, environment, lighting, and color palette. Previous video prompt for reference: {PREVIOUS_VIDEO_PROMPT}"

4. **Technical Parameters**

   - Resolution: {RESOLUTION}

   - Style: {VISUAL_STYLE}

   - High-quality anime visual consistency

5. **Output Format**

   - Output must be a **JSON object** (not array) with the following structure:

     {

       "scene_number": {SCENE_NUMBER},

       "character_continuity": "Confirm all characters retain entirely consistent appearance. Mention beard length in mm if applicable.",

       "environment_continuity": "Confirm the environment matches or explain minimal changes required by the story.",

       "technical_parameters": {

         "resolution": "{RESOLUTION}",

         "style": "{VISUAL_STYLE}",

         "quality": "High-quality anime visual consistency"

       },

       "scene_content": "Cinematic description of what happens in this scene.",

       "shots": [

         {

           "shot_number": 1,

           "camera_description": "Describe the framing, lens, angle, and movement.",

           "character_actions": "Describe exactly what each character is doing, based on the Scene Story.",

           "emotion": "Emotion expressed by characters.",

           "environment": "Describe background and lighting continuity.",

           "image_prompt": "AI-optimized still-image prompt. Must represent this exact shot and must reflect story content, character appearance, lighting, environment, and style.",

           "video_prompt": "AI-optimized animation prompt describing movement, pacing, character motion, camera motion, lighting changes, and emotional tone. Include continuity_reference for shots after the first."

         }

       ]

     }

   - **Do NOT include extra text outside JSON**

================ OUTPUT =================

Generate the JSON object for this scene following the rules above.`;

    // 10. 构建系统提示词（替换占位符）
    const finalSystemPrompt = systemPrompt
      .replace("{FULL_STORY}", fullStory.substring(0, 50000)) // 限制长度避免超出token限制
      .replace("{CHARACTERS_JSON}", JSON.stringify(characterInfo, null, 2))
      .replace("{ENVIRONMENT_JSON}", JSON.stringify(environmentInfo, null, 2))
      .replace("{VISUAL_STYLE}", visualStyleName)
      .replace("{RESOLUTION}", resolution)
      .replace("{SCENE_STORY}", sceneStory || sceneDescription)
      .replace("{SCENE_NUMBER}", String(sceneNumber));

    // 11. 构建用户提示词
    // User Prompt 应该明确引用 System Prompt 中提供的数据，而不是让 AI 自己生成数据
    const userPrompt = `Based on the Full Story Text, Character Info, Environment Info, Visual Style (${visualStyleName}), Resolution (${resolution}), and Scene Story provided in the system prompt above, please generate the storyboard shots for Scene ${sceneNumber} following all the rules and output format specified in the system prompt.

Use the actual story content, character details, and environment information from the system prompt - do not create new or different content.`;

    console.log("=== 生成分镜 - AI提示词 ===");
    console.log("System Prompt length:", finalSystemPrompt.length);
    console.log("System Prompt preview (first 1000 chars):", finalSystemPrompt.substring(0, 1000));
    console.log("System Prompt contains FULL_STORY:", finalSystemPrompt.includes(fullStory.substring(0, 100)) ? "Yes" : "No");
    console.log("System Prompt contains CHARACTERS_JSON:", finalSystemPrompt.includes(JSON.stringify(characterInfo).substring(0, 50)) ? "Yes" : "No");
    console.log("System Prompt contains ENVIRONMENT_JSON:", finalSystemPrompt.includes(JSON.stringify(environmentInfo).substring(0, 50)) ? "Yes" : "No");
    console.log("User Prompt:", userPrompt);
    console.log("--- Data Summary ---");
    console.log("Full Story length:", fullStory.length);
    console.log("Full Story preview (first 200 chars):", fullStory.substring(0, 200));
    console.log("Characters count:", characterInfo.length);
    console.log("Characters preview:", JSON.stringify(characterInfo.slice(0, 2), null, 2));
    console.log("Environment Info:", JSON.stringify(environmentInfo, null, 2));
    console.log("Visual Style:", visualStyleName);
    console.log("Resolution:", resolution);
    console.log("Scene Number:", sceneNumber);
    console.log("Scene Story length:", (sceneStory || sceneDescription).length);
    console.log("Scene Story preview:", (sceneStory || sceneDescription).substring(0, 200));

    // 7. 调用AI生成分镜
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "DASHSCOPE_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // 使用兼容模式端点，与 create-project 路由保持一致
    const response = await fetch(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "qwen-max",
          messages: [
            {
              role: "system",
              content: finalSystemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 8000, // 单个场景的分镜生成
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DashScope API error:", errorText);
      return NextResponse.json(
        { success: false, error: `AI generation failed: ${response.status}` },
        { status: 500 }
      );
    }

    const aiResult = await response.json();
    
    // 检查API响应
    console.log("=== DashScope API 响应 ===");
    console.log("aiResult keys:", Object.keys(aiResult));
    console.log("完整的 aiResult:", JSON.stringify(aiResult, null, 2));
    
    // 检查是否有错误
    if (aiResult.code || aiResult.message) {
      console.error("DashScope API returned error:", aiResult);
      return NextResponse.json(
        { 
          success: false, 
          error: `AI API error: ${aiResult.message || aiResult.code || 'Unknown error'}` 
        },
        { status: 500 }
      );
    }
    
    // 兼容模式端点返回格式: choices[0].message.content
    const content = aiResult.choices?.[0]?.message?.content || "";
    
    if (!content || content.trim().length === 0) {
      console.error("AI返回内容为空");
      console.error("完整的API响应:", JSON.stringify(aiResult, null, 2));
      return NextResponse.json(
        { 
          success: false, 
          error: "AI返回内容为空，可能是token限制太小或API调用失败" 
        },
        { status: 500 }
      );
    }
    
    let storyboardJson: any = null;

    // JSON 清理和修复函数（从 create-project 路由复制）
    function removeCommentsInValues(jsonStr: string): string {
      let result = '';
      let inString = false;
      let escapeNext = false;
      let inValue = false;
      let parenDepth = 0;
      
      for (let i = 0; i < jsonStr.length; i++) {
        const char = jsonStr[i];
        
        if (escapeNext) {
          result += char;
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          result += char;
          continue;
        }
        
        if (char === '"') {
          inString = !inString;
          result += char;
          if (!inString && inValue) {
            let j = i + 1;
            while (j < jsonStr.length && /\s/.test(jsonStr[j])) j++;
            if (j < jsonStr.length && jsonStr[j] === '(') {
              parenDepth = 1;
              j++;
              while (j < jsonStr.length && parenDepth > 0) {
                if (jsonStr[j] === '(') parenDepth++;
                else if (jsonStr[j] === ')') parenDepth--;
                j++;
              }
              i = j - 1;
              continue;
            }
          }
          continue;
        }
        
        if (inString) {
          result += char;
          continue;
        }
        
        if (char === ':') {
          inValue = true;
          result += char;
          continue;
        }
        
        if (char === ',' || char === '}' || char === ']') {
          inValue = false;
          result += char;
          continue;
        }
        
        if (inValue && char === '(') {
          let lookBack = result.length - 1;
          while (lookBack >= 0 && /\s/.test(result[lookBack])) lookBack--;
          if (lookBack >= 0 && (/\d/.test(result[lookBack]) || result[lookBack] === '"')) {
            parenDepth = 1;
            let j = i + 1;
            while (j < jsonStr.length && parenDepth > 0) {
              if (jsonStr[j] === '(') parenDepth++;
              else if (jsonStr[j] === ')') parenDepth--;
              j++;
            }
            i = j - 1;
            continue;
          }
        }
        
        result += char;
      }
      
      return result;
    }

    function cleanJsonString(str: string): string {
      let result = '';
      let inString = false;
      let escapeNext = false;
      let stringStart = -1;
      
      for (let i = 0; i < str.length; i++) {
        const char = str[i];
        
        if (escapeNext) {
          result += char;
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          result += char;
          continue;
        }
        
        if (char === '"') {
          if (!inString) {
            inString = true;
            stringStart = result.length;
            result += char;
          } else {
            inString = false;
            result += char;
          }
          continue;
        }
        
        if (inString) {
          if (char === '\n' || char === '\r') {
            result += '\\n';
          } else if (char === '\t') {
            result += '\\t';
          } else {
            result += char;
          }
        } else {
          result += char;
        }
      }
      
      return result;
    }

    function fixJsonErrors(jsonStr: string): string {
      // 修复未转义的换行符
      jsonStr = jsonStr.replace(/([^\\]|^)"([^"]*)\n([^"]*)"([^\\]|$)/g, (match, before, part1, part2, after) => {
        return `${before}"${part1}\\n${part2}"${after}`;
      });
      
      // 修复缺失的逗号（在数组元素之间）
      jsonStr = jsonStr.replace(/\]\s*\[/g, '],[');
      jsonStr = jsonStr.replace(/\}\s*\{/g, '},{');
      
      // 修复缺失的逗号（在对象属性之间）
      jsonStr = jsonStr.replace(/(")\s*(")/g, '$1,$2');
      jsonStr = jsonStr.replace(/(")\s*(")/g, '$1,$2');
      
      // 修复缺失的逗号（在值之后，下一个键之前）
      jsonStr = jsonStr.replace(/([^,}\]])\s*(")/g, (match, before, quote) => {
        if (before.trim() && !before.endsWith(',')) {
          return `${before},${quote}`;
        }
        return match;
      });
      
      return jsonStr;
    }

    // 解析AI返回的JSON（多阶段尝试）
    try {
      console.log("提取的内容长度:", content.length);
      console.log("AI返回内容预览:", content.substring(0, 500));
      console.log("AI返回内容结尾:", content.substring(Math.max(0, content.length - 500)));

      // 第一阶段：基本清理
      let jsonStr = content.trim();
      
      // 移除 markdown 代码块
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "");
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```\s*/i, "").replace(/\s*```\s*$/i, "");
      }
      
      // 移除可能的 "Scene X:" 前缀
      jsonStr = jsonStr.replace(/^Scene\s+\d+\s*:\s*/i, '');
      
      // 尝试找到 JSON 数组或对象的开始和结束
      // 先检查是否是数组格式
      const arrayStart = jsonStr.indexOf('[');
      const arrayEnd = jsonStr.lastIndexOf(']');
      const objectStart = jsonStr.indexOf('{');
      const objectEnd = jsonStr.lastIndexOf('}');
      
      // 优先处理数组格式（新格式）
      if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
        jsonStr = jsonStr.substring(arrayStart, arrayEnd + 1);
      } else if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
        // 兼容旧格式（单个对象）
        jsonStr = jsonStr.substring(objectStart, objectEnd + 1);
      } else if (objectStart !== -1) {
        // 如果只有开始，尝试修复
        jsonStr = jsonStr.substring(objectStart);
        // 尝试添加缺失的结束括号
        let openBraces = (jsonStr.match(/\{/g) || []).length;
        let closeBraces = (jsonStr.match(/\}/g) || []).length;
        while (openBraces > closeBraces) {
          jsonStr += '}';
          closeBraces++;
        }
      }

      // 第二阶段：尝试直接解析
      try {
        storyboardJson = JSON.parse(jsonStr);
        console.log("Successfully parsed JSON on first attempt");
      } catch (firstError: any) {
        console.error("First parse attempt failed:", firstError.message);
        
        // 第三阶段：移除注释后解析
        try {
          let cleanedJson = removeCommentsInValues(jsonStr);
          storyboardJson = JSON.parse(cleanedJson);
          console.log("Successfully parsed after removing comments");
        } catch (secondError: any) {
          console.error("Second parse attempt failed:", secondError.message);
          
          // 第四阶段：清理字符串后解析
          try {
            let cleanedJson = cleanJsonString(jsonStr);
            storyboardJson = JSON.parse(cleanedJson);
            console.log("Successfully parsed after cleaning string");
          } catch (thirdError: any) {
            console.error("Third parse attempt failed:", thirdError.message);
            
            // 第五阶段：修复 JSON 错误后解析
            try {
              let cleanedJson = fixJsonErrors(jsonStr);
              storyboardJson = JSON.parse(cleanedJson);
              console.log("Successfully parsed after fixing JSON errors");
            } catch (fourthError: any) {
              console.error("Fourth parse attempt failed:", fourthError.message);
              console.error("JSON string length:", jsonStr.length);
              console.error("JSON string preview:", jsonStr.substring(0, 1000));
              console.error("JSON string ending:", jsonStr.substring(Math.max(0, jsonStr.length - 1000)));
              
              // 最后尝试：移除所有可能的非 JSON 内容
              try {
                // 尝试提取完整的 JSON 数组或对象
                const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
                const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
                if (arrayMatch) {
                  storyboardJson = JSON.parse(arrayMatch[0]);
                  console.log("Successfully parsed using regex extraction (array)");
                } else if (objectMatch) {
                  storyboardJson = JSON.parse(objectMatch[0]);
                  console.log("Successfully parsed using regex extraction (object)");
                } else {
                  throw new Error("Could not extract valid JSON");
                }
              } catch (finalError: any) {
                console.error("All parse attempts failed:", finalError.message);
                return NextResponse.json(
                  { 
                    success: false, 
                    error: `Failed to parse AI response: ${finalError.message}. Content length: ${content.length}, JSON length: ${jsonStr.length}` 
                  },
                  { status: 500 }
                );
              }
            }
          }
        }
      }
    } catch (parseError: any) {
      console.error("Failed to parse AI response:", parseError);
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to parse AI response: ${parseError.message}` 
        },
        { status: 500 }
      );
    }

    // 11. 转换新格式到兼容格式（如果需要）
    // 新格式可能包含 scene_content, character_continuity, environment_continuity 等字段
    // 为了兼容现有代码，我们需要确保有 scene_title 和 scene_summary
    if (storyboardJson) {
      // 如果新格式有 scene_content，转换为 scene_summary
      if (storyboardJson.scene_content && !storyboardJson.scene_summary) {
        storyboardJson.scene_summary = storyboardJson.scene_content;
      }
      // 如果没有 scene_title，从 scene_content 或 scene_summary 生成
      if (!storyboardJson.scene_title) {
        const sceneTitleSource = storyboardJson.scene_content || storyboardJson.scene_summary || "";
        // 提取前50个字符作为标题
        storyboardJson.scene_title = sceneTitleSource.substring(0, 50).trim() || `Scene ${sceneNumber}`;
      }
    }

    // 12. 为每个shot添加characters字段（从场次的"主要角色"中提取，如果没取到则从数据库角色表匹配）
    if (storyboardJson && storyboardJson.shots && Array.isArray(storyboardJson.shots)) {
      // 提取角色名称列表
      let characterNames: string[] = [];
      
      // 方法1: 从 metadata.主要角色 提取
      if (mainCharacters && Array.isArray(mainCharacters) && mainCharacters.length > 0) {
        mainCharacters.forEach((char: any) => {
          if (typeof char === 'string') {
            characterNames.push(char.trim());
          } else if (char && typeof char === 'object') {
            // 可能是 { 姓名: "xxx" } 格式
            const name = char.姓名 || char.name || char.角色名称 || '';
            if (name) {
              characterNames.push(String(name).trim());
            }
          }
        });
      }
      
      console.log("从主要角色字段提取的角色名称:", characterNames);
      
      // 方法2: 如果没取到，直接从数据库角色表中匹配出现在场次文本中的角色
      if (characterNames.length === 0) {
        console.log("主要角色字段为空或未取到，从数据库角色表中匹配场次文本中的角色...");
        
        // 合并场次描述和场次故事文本
        const sceneText = ((sceneDescription || '') + ' ' + (sceneStory || '')).trim();
        console.log("场次文本长度:", sceneText.length);
        console.log("场次文本预览:", sceneText.substring(0, 200));
        
        // 从数据库角色表中匹配出现在场次文本中的角色
        if (characters && Array.isArray(characters) && characters.length > 0) {
          console.log("数据库角色表中共有", characters.length, "个角色");
          
          characters.forEach((char: any) => {
            const charName = char.name || char.姓名 || '';
            if (charName) {
              const nameStr = String(charName).trim();
              // 检查角色名称是否出现在场次文本中
              if (sceneText && sceneText.includes(nameStr)) {
                characterNames.push(nameStr);
                console.log(`  ✓ 匹配到角色: "${nameStr}"`);
              }
            }
          });
        }
        
        // 方法3: 如果还是没找到，使用数据库中的所有角色（至少保证有角色数据）
        if (characterNames.length === 0) {
          console.log("场次文本中未匹配到角色，使用数据库中的所有角色...");
          if (characters && Array.isArray(characters) && characters.length > 0) {
            characters.forEach((char: any) => {
              const charName = char.name || char.姓名 || '';
              if (charName) {
                characterNames.push(String(charName).trim());
              }
            });
            console.log("使用所有角色:", characterNames);
          }
        }
        
        // 方法4: 如果数据库角色表也没有，尝试从AI生成的分镜JSON中的characters字段提取（新格式可能没有这个字段）
        if (characterNames.length === 0 && storyboardJson.characters && Array.isArray(storyboardJson.characters)) {
          console.log("尝试从AI生成的分镜JSON中提取角色...");
          storyboardJson.characters.forEach((char: any) => {
            const charName = char.name || char.姓名 || '';
            if (charName) {
              characterNames.push(String(charName).trim());
            }
          });
        }
        
        // 方法5: 从新格式的 character_continuity 字段中提取角色名称（如果存在）
        if (characterNames.length === 0 && storyboardJson.character_continuity) {
          // 尝试从 character_continuity 文本中提取角色名称
          characters.forEach((char: any) => {
            const charName = char.name || char.姓名 || '';
            if (charName && storyboardJson.character_continuity.includes(charName)) {
              characterNames.push(String(charName).trim());
            }
          });
        }
      }
      
      const charactersString = characterNames.filter(name => name.length > 0).join(', ');
      
      console.log("最终提取的角色名称:", characterNames);
      console.log("角色字符串:", charactersString);
      
      // 为每个shot添加characters字段，并确保image_prompt和video_prompt都存在
      // 新格式的shot可能包含 camera_description, character_actions, emotion, environment 等字段
      storyboardJson.shots = storyboardJson.shots.map((shot: any) => {
        const updatedShot = {
          ...shot,
          characters: shot.characters || charactersString, // 如果AI已经生成了characters字段，使用它；否则使用从场次提取的角色
        };
        
        // 确保image_prompt存在（新格式应该已经包含）
        if (!updatedShot.image_prompt) {
          console.warn(`Shot ${updatedShot.shot_number} missing image_prompt, using description or camera_description as fallback`);
          updatedShot.image_prompt = updatedShot.description || updatedShot.camera_description || "";
        }
        
        // 确保video_prompt存在（新格式应该已经包含）
        if (!updatedShot.video_prompt) {
          console.warn(`Shot ${updatedShot.shot_number} missing video_prompt, generating from image_prompt`);
          updatedShot.video_prompt = updatedShot.image_prompt || updatedShot.description || "";
        }
        
        // 为了兼容性，确保有 description 字段（如果没有，从 camera_description 或其他字段生成）
        if (!updatedShot.description && updatedShot.camera_description) {
          updatedShot.description = `${updatedShot.camera_description}. ${updatedShot.character_actions || ''}. ${updatedShot.emotion || ''}. ${updatedShot.environment || ''}`;
        }
        
        // 为了兼容性，确保有 framing, camera_angle, camera_movement 等字段（从 camera_description 提取或使用默认值）
        if (!updatedShot.framing && updatedShot.camera_description) {
          // 尝试从 camera_description 中提取 framing 信息
          const camDesc = updatedShot.camera_description.toLowerCase();
          if (camDesc.includes('wide') || camDesc.includes('extreme wide')) {
            updatedShot.framing = camDesc.includes('extreme') ? 'ES' : 'WTS';
          } else if (camDesc.includes('medium')) {
            updatedShot.framing = 'MS';
          } else if (camDesc.includes('close')) {
            updatedShot.framing = camDesc.includes('extreme') ? 'ECU' : 'CU';
          } else {
            updatedShot.framing = 'MS'; // 默认值
          }
        }
        
        if (!updatedShot.camera_angle && updatedShot.camera_description) {
          const camDesc = updatedShot.camera_description.toLowerCase();
          if (camDesc.includes('low') || camDesc.includes('low-angle')) {
            updatedShot.camera_angle = 'low-angle';
          } else if (camDesc.includes('high') || camDesc.includes('high-angle')) {
            updatedShot.camera_angle = 'high-angle';
          } else if (camDesc.includes('overhead')) {
            updatedShot.camera_angle = 'overhead';
          } else {
            updatedShot.camera_angle = 'eye-level'; // 默认值
          }
        }
        
        if (!updatedShot.camera_movement && updatedShot.camera_description) {
          const camDesc = updatedShot.camera_description.toLowerCase();
          if (camDesc.includes('dolly') || camDesc.includes('track')) {
            updatedShot.camera_movement = camDesc.includes('in') ? 'dolly-in' : camDesc.includes('out') ? 'dolly-out' : 'tracking shot';
          } else if (camDesc.includes('pan')) {
            updatedShot.camera_movement = 'pan';
          } else if (camDesc.includes('tilt')) {
            updatedShot.camera_movement = 'tilt';
          } else {
            updatedShot.camera_movement = 'static'; // 默认值
          }
        }
        
        return updatedShot;
      });
      
      console.log("已为所有shot添加characters字段，每个shot的字段:", 
        storyboardJson.shots.map((s: any) => ({ 
          shot_number: s.shot_number, 
          characters: s.characters,
          has_image_prompt: !!s.image_prompt,
          has_video_prompt: !!s.video_prompt,
          image_prompt_length: s.image_prompt?.length || 0,
          video_prompt_length: s.video_prompt?.length || 0
        }))
      );
    }

    // 9. 保存分镜数据到数据库（更新 scene_item 的 metadata）
    // 确保所有shot都包含image_prompt和video_prompt
    if (storyboardJson && storyboardJson.shots && Array.isArray(storyboardJson.shots)) {
      storyboardJson.shots = storyboardJson.shots.map((shot: any) => {
        // 确保image_prompt和video_prompt都存在
        if (!shot.image_prompt) {
          shot.image_prompt = shot.description || "";
        }
        if (!shot.video_prompt) {
          shot.video_prompt = shot.image_prompt || shot.description || "";
        }
        return shot;
      });
    }
    
    const updatedMetadata = {
      ...metadata,
      storyboard: storyboardJson, // 保存完整的分镜JSON（包含image_prompt和video_prompt字段）
    };
    
    console.log("保存到数据库的分镜数据预览:", {
      scene_title: storyboardJson?.scene_title,
      shots_count: storyboardJson?.shots?.length,
      first_shot_fields: storyboardJson?.shots?.[0] ? Object.keys(storyboardJson.shots[0]) : [],
      first_shot_has_image_prompt: !!storyboardJson?.shots?.[0]?.image_prompt,
      first_shot_has_video_prompt: !!storyboardJson?.shots?.[0]?.video_prompt,
    });

    const { error: updateError } = await supabase
      .from("anim_scene_items")
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scene_item_id);

    if (updateError) {
      console.error("Error updating scene item:", updateError);
      return NextResponse.json(
        { success: false, error: `Failed to save storyboard: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        storyboard: storyboardJson,
      },
    });
  } catch (error) {
    console.error("Error generating storyboard:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

