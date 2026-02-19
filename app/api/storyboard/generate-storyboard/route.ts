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
    const sceneTitle = metadata.scene_title || metadata.场次标题 || `Scene ${sceneItem.scene_number || 1}`;
    const sceneTime = metadata.场次时间 || metadata.scene_time || "";
    const sceneLocation = metadata.场次地点 || metadata.scene_location || "";
    const sceneDescription = sceneItem.text || "";
    const sceneStory = metadata.场次故事 || metadata.scene_story || "";
    const sceneElements = metadata.scene_elements || metadata.场次元素 || [];
    const mainCharacters = metadata.主要角色 || metadata.main_characters || [];
    const sceneNumber = sceneItem.scene_number || 1;

    // 5. 不再需要获取完整故事文本，新格式只需要场次内容

    // 6. 不再需要构建环境信息和详细角色信息，新格式只需要角色名称列表

    // 9. Build AI prompt (new instruction)
    const systemPrompt = `LANGUAGE REQUIREMENT (CRITICAL): All output content MUST be in English only. No Chinese, Japanese, or any other non-English characters in the generated content. All field values (scene titles, descriptions, dialogue, image descriptions, video descriptions, etc.) must be in English.

You are a professional cinematic storyboard director specializing in animation, continuous character motion, emotional consistency, scene continuity, and automatic costume inference.

Task:

Given an existing scene JSON (sceneTitle, sceneTime, sceneLocation, sceneDescription, sceneStory, sceneElements), generate a complete storyboard JSON containing **4–12 continuous shots**. Each shot must maintain:

- Character positions, costumes, expressions, and interactions
- Environmental, prop, and building continuity
- Emotional pacing matching the scene's mood
- Scene-specific monologue or dialogue (if present)

Shot Requirements:

1. imageShot.imageDescription (English):
- Provide a full **AI image generation prompt** for this shot
- Include all characters, props, vehicles, buildings, environment details
- Characters: appearance, pose, exact position, interactions
- Environment: background, lighting, weather, textures
- Artistic style, cinematic feel, animation-ready
- Distance type: wide, medium, close-up
- Ensure all elements from previous shot are inherited unless changed

2. videoShot.videoDescription (English):
- Cinematic description including:
  - Shot type and framing
  - Camera movement (pan, tilt, dolly, track, push/pull, crane)
  - Character movements, timing, and emotional pacing
  - Environmental motion (wind, rain, fog, lights)
  - Object/vehicle movements
  - Audio design (environmental sounds, background music, fades, emotional cues)
  - Scene transitions (cut, dissolve, match cut, continuous movement)
- Ensure continuity with previous shot in positions, actions, expressions, costumes, and scene objects

Continuity Rules:
- Backgrounds, props, buildings, and character positions must remain consistent unless the scene explicitly changes
- Actions started in one shot continue or resolve naturally in the next
- Characters and props persist throughout the scene

JSON Output Structure:

{
  "sceneTitle": "",
  "charactersDetected": [],
  "locationDetected": "",
  "fixedClothingStyle": "",
  "shotList": [
    {
      "shotNumber": 1,
      "previousShotContinuation": "",
      "appearCharacters": [],
      "narration": "",
      "dialogue": "",
      "imageShot": {
        "imageDescription": ""  ← AI image generation prompt in English
      },
      "videoShot": {
        "videoDescription": ""  ← Cinematic description including camera motion and audio
      }
    }
  ]
}

Input:
{sceneJSON}`;

    // 10. 提取场次中的角色名称列表
    let sceneCharacterNames: string[] = [];
    
    // 方法1: 从 metadata.主要角色 提取
    if (mainCharacters && Array.isArray(mainCharacters) && mainCharacters.length > 0) {
      mainCharacters.forEach((char: any) => {
        if (typeof char === 'string') {
          sceneCharacterNames.push(char.trim());
        } else if (char && typeof char === 'object') {
          const name = char.姓名 || char.name || char.角色名称 || '';
          if (name) {
            sceneCharacterNames.push(String(name).trim());
          }
        }
      });
    }
    
    // 方法2: 如果没取到，从数据库角色表中匹配出现在场次文本中的角色（只匹配出现在场次内容中的角色）
    if (sceneCharacterNames.length === 0 && characters && Array.isArray(characters)) {
      const sceneText = ((sceneDescription || '') + ' ' + (sceneStory || '')).trim();
      characters.forEach((char: any) => {
        const charName = char.name || char.姓名 || '';
        if (charName) {
          const nameStr = String(charName).trim();
          // 只匹配出现在场次文本中的角色
          if (sceneText && sceneText.includes(nameStr)) {
            sceneCharacterNames.push(nameStr);
          }
        }
      });
    }
    
    // 不再使用方法3（使用所有角色），只使用该场次对应的角色
    if (sceneCharacterNames.length === 0) {
    }
    // 11. 构建系统提示词（新格式不需要替换占位符，直接使用）
    const finalSystemPrompt = systemPrompt;

    // 12. 构建用户提示词（构建 sceneJSON 对象）
    const sceneJSON = {
      sceneTitle: sceneTitle,
      sceneTime: sceneTime,
      sceneLocation: sceneLocation,
      sceneDescription: sceneDescription,
      sceneStory: sceneStory || sceneDescription,
      sceneElements: Array.isArray(sceneElements) ? sceneElements : []
    };
    
    const userPrompt = JSON.stringify(sceneJSON, null, 2);

    // 7. 调用AI生成分镜
    // ========== 原来的 DashScope API 调用（已注释） ==========
    // const apiKey = process.env.DASHSCOPE_API_KEY;
    // if (!apiKey) {
    //   return NextResponse.json(
    //     { success: false, error: "DASHSCOPE_API_KEY is not configured" },
    //     { status: 500 }
    //   );
    // }

    // // 使用兼容模式端点，与 create-project 路由保持一致
    // const response = await fetch(
    //   "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    //   {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //       Authorization: `Bearer ${apiKey}`,
    //     },
    //     body: JSON.stringify({
    //       model: "qwen-max",
    //       messages: [
    //         {
    //           role: "system",
    //           content: finalSystemPrompt,
    //         },
    //         {
    //           role: "user",
    //           content: userPrompt,
    //         },
    //       ],
    //       temperature: 0.35,
    //       max_tokens: 8000, // 单个场景的分镜生成
    //     }),
    //   }
    // );

    // if (!response.ok) {
    //   const errorText = await response.text();
    //   return NextResponse.json(
    //     { success: false, error: `AI generation failed: ${response.status}` },
    //     { status: 500 }
    //   );
    // }

    // const aiResult = await response.json();
    
    // // 检查API响应
    // // 检查是否有错误
    // if (aiResult.code || aiResult.message) {
    //   return NextResponse.json(
    //     { 
    //       success: false, 
    //       error: `AI API error: ${aiResult.message || aiResult.code || 'Unknown error'}` 
    //     },
    //     { status: 500 }
    //   );
    // }
    
    // // 兼容模式端点返回格式: choices[0].message.content
    // const content = aiResult.choices?.[0]?.message?.content || "";

    // ========== 使用 Laozhang API 调用 ==========
    // 使用 Laozhang API Key
    const apiKey = process.env.LAOZHANG_API_KEY_STORY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "LAOZHANG_API_KEY_STORY is not configured" },
        { status: 500 }
      );
    }

    // 构建请求参数（使用 OpenAI 兼容格式）
    const requestBody = {
      model: "gpt-4o-mini",
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
      temperature: 0.35,
      max_tokens: 8000, // 单个场景的分镜生成
    };

    // 调用 Laozhang Chat Completions API
    const response = await fetch(
      "https://api.laozhang.ai/v1/chat/completions",
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
            error: "API key authentication failed. Please check your LAOZHANG_API_KEY_STORY environment variable.",
            details: errorText,
          },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        {
          success: false,
            error: `Laozhang API error: ${response.status}. ${errorText.substring(0, 200)}`,
        },
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    let aiResult;
    try {
      aiResult = await response.json();
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
    
    // 检查API响应
    // 检查是否有错误
    if (aiResult.code || aiResult.message) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Doubao API error: ${aiResult.message || aiResult.code || 'Unknown error'}` 
        },
        { status: 500 }
      );
    }
    
    // doubao API 返回格式与 OpenAI 兼容: choices[0].message.content
    const content = aiResult.choices?.[0]?.message?.content || "";
    
    if (!content || content.trim().length === 0) {
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
      // 优先提取最外层的对象（因为AI返回的是对象格式，包含 sceneTitle, shotList 等）
      const objectStart = jsonStr.indexOf('{');
      const objectEnd = jsonStr.lastIndexOf('}');
      const arrayStart = jsonStr.indexOf('[');
      const arrayEnd = jsonStr.lastIndexOf(']');
      
      // 优先处理对象格式（最外层对象）
      if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
        // 检查是否是最外层对象（对象开始位置应该早于或等于数组开始位置）
        if (arrayStart === -1 || objectStart <= arrayStart) {
          jsonStr = jsonStr.substring(objectStart, objectEnd + 1);
        } else {
          // 如果数组在最外层，则提取数组
          jsonStr = jsonStr.substring(arrayStart, arrayEnd + 1);
        }
      } else if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
        // 如果没有对象，但有数组，则提取数组
        jsonStr = jsonStr.substring(arrayStart, arrayEnd + 1);
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
        // 检查是否是数组格式（AI可能直接返回shotList数组）
        if (Array.isArray(storyboardJson)) {
          // 如果返回的是数组，转换为对象格式
          storyboardJson = {
            sceneTitle: `Scene ${sceneNumber}`,
            shotList: storyboardJson,
          };
        }
        if (storyboardJson?.shots?.[0]) {
        } else if (storyboardJson?.shotList?.[0]) {
        } else {
        }
      } catch (firstError: any) {
        // 第三阶段：移除注释后解析
        try {
          let cleanedJson = removeCommentsInValues(jsonStr);
          storyboardJson = JSON.parse(cleanedJson);
        } catch (secondError: any) {
          // 第四阶段：清理字符串后解析
          try {
            let cleanedJson = cleanJsonString(jsonStr);
            storyboardJson = JSON.parse(cleanedJson);
          } catch (thirdError: any) {
            // 第五阶段：修复 JSON 错误后解析
            try {
              let cleanedJson = fixJsonErrors(jsonStr);
              storyboardJson = JSON.parse(cleanedJson);
            } catch (fourthError: any) {
              // 最后尝试：移除所有可能的非 JSON 内容
              try {
                // 尝试提取完整的 JSON 对象或数组（优先对象）
                // 使用非贪婪匹配，找到最外层的对象/数组
                const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
                const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
                
                // 优先处理对象格式
                if (objectMatch) {
                  storyboardJson = JSON.parse(objectMatch[0]);
                } else if (arrayMatch) {
                  storyboardJson = JSON.parse(arrayMatch[0]);
                } else {
                  throw new Error("Could not extract valid JSON");
                }
              } catch (finalError: any) {
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
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to parse AI response: ${parseError.message}` 
        },
        { status: 500 }
      );
    }

    // 11. 转换新格式到兼容格式
    // 新格式: { title, summary, shots: [{ id, scene, time, camera, environment, characters[], objects[], videoShot }] }
    // 兼容格式: { scene_title, scene_summary, shots: [{ shot_number, description, image_prompt, video_prompt, narration, dialogue }] }
    if (storyboardJson) {
      // 检查是否是新格式（有 shotList）
      if (storyboardJson.shotList && Array.isArray(storyboardJson.shotList)) {
        // 转换 sceneTitle -> scene_title
        if (storyboardJson.sceneTitle) {
          storyboardJson.scene_title = storyboardJson.sceneTitle;
        } else {
          storyboardJson.scene_title = `Scene ${sceneNumber}`;
        }
        
        // Convert shotList -> shots, and map field names
        // New format: imageShot.imageDescription -> image_prompt, videoShot.videoDescription -> video_prompt
        // Also support direct fields: imageDescription -> image_prompt, videoDescription -> video_prompt
        storyboardJson.shots = storyboardJson.shotList.map((shot: any) => {
          return {
            shot_number: shot.shotNumber || shot.shot_number || 0,
            description: shot.imageShot?.imageDescription || shot.imageDescription || shot.shotDescription || shot.description || "",
            image_prompt: shot.imageShot?.imageDescription || shot.imageDescription || shot.imagePrompt || shot.image_prompt || "",
            video_prompt: shot.videoShot?.videoDescription || shot.videoDescription || shot.videoPrompt || shot.video_prompt || "",
            narration: shot.narration || "",
            dialogue: shot.dialogue || "",
            characters: shot.appearCharacters?.join(', ') || shot.characters || "",
            appearCharacters: shot.appearCharacters || (shot.characters && typeof shot.characters === 'string' ? shot.characters.split(',').map((c: string) => c.trim()) : []),
            previousShotContinuation: shot.previousShotContinuation || "",
            // Preserve original fields for compatibility
            ...shot,
          };
        });
        
        // Extract charactersDetected if available and use it for character extraction
        if (storyboardJson.charactersDetected && Array.isArray(storyboardJson.charactersDetected) && storyboardJson.charactersDetected.length > 0) {
          // Store for later use in character extraction
          storyboardJson._aiDetectedCharacters = storyboardJson.charactersDetected;
        }
        
        // Extract and preserve new fields: locationDetected and fixedClothingStyle
        if (storyboardJson.locationDetected) {
          storyboardJson.location_detected = storyboardJson.locationDetected;
        }
        
        if (storyboardJson.fixedClothingStyle) {
          storyboardJson.fixed_clothing_style = storyboardJson.fixedClothingStyle;
        }
        
        // 生成 scene_summary（从第一个shot的narration或description）
        if (!storyboardJson.scene_summary) {
          const firstShot = storyboardJson.shots[0];
          if (firstShot) {
            storyboardJson.scene_summary = firstShot.narration || firstShot.description || storyboardJson.scene_title;
          } else {
            storyboardJson.scene_summary = storyboardJson.scene_title;
          }
        }
        
        // Delete new format fields (but preserve location_detected and fixed_clothing_style)
        delete storyboardJson.shotList;
        delete storyboardJson.sceneTitle;
        delete storyboardJson.charactersDetected; // Clean up after extraction
        delete storyboardJson.locationDetected; // Clean up after extraction (using location_detected)
        delete storyboardJson.fixedClothingStyle; // Clean up after extraction (using fixed_clothing_style)
      } else if (storyboardJson.shots && Array.isArray(storyboardJson.shots)) {
        const firstShot = storyboardJson.shots[0];
        const looksLikeNewShotSchema =
          !!firstShot &&
          (
            (typeof firstShot.camera === 'object' && firstShot.camera !== null) ||
            (typeof firstShot.videoShot === 'string') ||
            (Array.isArray(firstShot.characters) && firstShot.characters.length > 0 && typeof firstShot.characters[0] === 'object') ||
            (typeof firstShot.environment === 'string' && !('image_prompt' in firstShot))
          );
        
        if (looksLikeNewShotSchema || storyboardJson.title || storyboardJson.summary) {
          const convertedShots = storyboardJson.shots.map((shot: any, index: number) => {
            const characterDetails = Array.isArray(shot.characters) ? shot.characters : [];
            const objectDetails = Array.isArray(shot.objects) ? shot.objects : [];
            
            const appearCharacters = characterDetails
              .map((char: any) => (char && typeof char === 'object' && char.name ? String(char.name).trim() : ''))
              .filter((name: string) => !!name);
            
            const characterSummary = characterDetails
              .map((char: any) => {
                if (!char || typeof char !== 'object') return '';
                const parts: string[] = [];
                if (char.name) parts.push(`${char.name}`);
                const detailBits: string[] = [];
                if (char.position) detailBits.push(`position ${char.position}`);
                if (char.action) detailBits.push(`action ${char.action}`);
                if (char.orientation) detailBits.push(`facing ${char.orientation}`);
                if (char.expression) detailBits.push(`expression ${char.expression}`);
                if (detailBits.length > 0) {
                  parts.push(`(${detailBits.join(', ')})`);
                }
                return parts.join(' ');
              })
              .filter(Boolean)
              .join(' ');
            
            const objectsSummary = objectDetails
              .map((obj: any) => {
                if (!obj || typeof obj !== 'object') return '';
                const objParts: string[] = [];
                if (obj.name) objParts.push(`${obj.name}`);
                const stateBits: string[] = [];
                if (obj.position) stateBits.push(`position ${obj.position}`);
                if (obj.state) stateBits.push(`state ${obj.state}`);
                if (stateBits.length > 0) {
                  objParts.push(`(${stateBits.join(', ')})`);
                }
                return objParts.join(' ');
              })
              .filter(Boolean)
              .join(' ');
            
            const descriptionParts: string[] = [];
            if (shot.scene) descriptionParts.push(`Scene: ${shot.scene}`);
            if (shot.time) descriptionParts.push(`Time: ${shot.time}`);
            if (shot.environment) descriptionParts.push(`Environment: ${shot.environment}`);
            if (characterSummary) descriptionParts.push(`Characters: ${characterSummary}`);
            if (objectsSummary) descriptionParts.push(`Objects: ${objectsSummary}`);
            if (shot.camera) {
              const cameraBits: string[] = [];
              if (shot.camera.shotType) cameraBits.push(`type ${shot.camera.shotType}`);
              if (shot.camera.angle) cameraBits.push(`angle ${shot.camera.angle}`);
              if (shot.camera.movement) cameraBits.push(`movement ${shot.camera.movement}`);
              if (cameraBits.length > 0) {
                descriptionParts.push(`Camera: ${cameraBits.join(', ')}`);
              }
            }
            const descriptionText = descriptionParts.join(' ').trim();
            const videoShotText = typeof shot.videoShot === 'string'
              ? shot.videoShot
              : shot.videoShot?.videoDescription || shot.videoDescription || '';
            const imageShotText = shot.imageShot?.imageDescription || shot.imageDescription || descriptionText || '';
            
            return {
              ...shot,
              shot_number: shot.id ?? shot.shot_number ?? index + 1,
              description: descriptionText || imageShotText || videoShotText || '',
              image_prompt: imageShotText || descriptionText || videoShotText || '',
              video_prompt: videoShotText,
              narration: shot.narration || '',
              dialogue: shot.dialogue || '',
              characters: appearCharacters.join(', '),
              appearCharacters,
              previousShotContinuation: shot.previousShotContinuation || '',
              character_layout: characterDetails,
              object_layout: objectDetails,
            };
          });
          
          storyboardJson.shots = convertedShots;
          const resolvedSceneTitle = String(storyboardJson.title || storyboardJson.scene_title || `Scene ${sceneNumber}`).trim() || `Scene ${sceneNumber}`;
          storyboardJson.scene_title = resolvedSceneTitle;
          const resolvedSummarySource = storyboardJson.summary || storyboardJson.scene_summary || resolvedSceneTitle;
          storyboardJson.scene_summary = String(resolvedSummarySource || resolvedSceneTitle).trim() || resolvedSceneTitle;
          
          const detectedCharacters = new Set<string>();
          convertedShots.forEach((shot: any) => {
            if (Array.isArray(shot.appearCharacters)) {
              shot.appearCharacters.forEach((name: string) => {
                if (name) detectedCharacters.add(name);
              });
            }
          });
          if (detectedCharacters.size > 0) {
            storyboardJson._aiDetectedCharacters = Array.from(detectedCharacters);
          }
          
          if (!storyboardJson.summary) {
            storyboardJson.summary = storyboardJson.scene_summary;
          }
          
          if (!storyboardJson.location_detected) {
            const firstScene = firstShot?.scene;
            if (typeof firstScene === 'string' && firstScene.trim()) {
              storyboardJson.location_detected = firstScene.trim();
            }
          }
        } else {
          // 旧格式，确保有 scene_title 和 scene_summary
          if (storyboardJson.scene_content && !storyboardJson.scene_summary) {
            storyboardJson.scene_summary = storyboardJson.scene_content;
          }
          if (!storyboardJson.scene_title) {
            const sceneTitleSource = storyboardJson.scene_content || storyboardJson.scene_summary || "";
            storyboardJson.scene_title = sceneTitleSource.substring(0, 50).trim() || `Scene ${sceneNumber}`;
          }
        }
      }
    } else {
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
      // 方法2: 如果没取到，直接从数据库角色表中匹配出现在场次文本中的角色
      if (characterNames.length === 0) {
        // 合并场次描述和场次故事文本
        const sceneText = ((sceneDescription || '') + ' ' + (sceneStory || '')).trim();
        // 从数据库角色表中匹配出现在场次文本中的角色
        if (characters && Array.isArray(characters) && characters.length > 0) {
          characters.forEach((char: any) => {
            const charName = char.name || char.姓名 || '';
            if (charName) {
              const nameStr = String(charName).trim();
              // 检查角色名称是否出现在场次文本中
              if (sceneText && sceneText.includes(nameStr)) {
                characterNames.push(nameStr);
              }
            }
          });
        }
        
        // 方法3: 如果还是没找到，使用数据库中的所有角色（至少保证有角色数据）
        if (characterNames.length === 0) {
          if (characters && Array.isArray(characters) && characters.length > 0) {
            characters.forEach((char: any) => {
              const charName = char.name || char.姓名 || '';
              if (charName) {
                characterNames.push(String(charName).trim());
              }
            });
          }
        }
        
        // Method 4: If still no characters found, try to extract from AI's charactersDetected field (new format)
        if (characterNames.length === 0 && storyboardJson._aiDetectedCharacters && Array.isArray(storyboardJson._aiDetectedCharacters)) {
          storyboardJson._aiDetectedCharacters.forEach((charName: any) => {
            if (typeof charName === 'string' && charName.trim()) {
              characterNames.push(charName.trim());
            } else if (charName && typeof charName === 'object') {
              const name = charName.name || charName.姓名 || '';
              if (name) {
                characterNames.push(String(name).trim());
              }
            }
          });
        }
        
        // Method 5: If still no characters, try to extract from AI's characters field (old format)
        if (characterNames.length === 0 && storyboardJson.characters && Array.isArray(storyboardJson.characters)) {
          storyboardJson.characters.forEach((char: any) => {
            const charName = char.name || char.姓名 || '';
            if (charName) {
              characterNames.push(String(charName).trim());
            }
          });
        }
        
        // Method 6: Extract from character_continuity field if exists (old format)
        if (characterNames.length === 0 && storyboardJson.character_continuity) {
          // Try to extract character names from character_continuity text
          characters.forEach((char: any) => {
            const charName = char.name || char.姓名 || '';
            if (charName && storyboardJson.character_continuity.includes(charName)) {
              characterNames.push(String(charName).trim());
            }
          });
        }
      }
      
      const charactersString = characterNames.filter(name => name.length > 0).join(', ');
      // Add characters field to each shot, and ensure image_prompt and video_prompt exist
      // New format shot may contain appearCharacters, previousShotContinuation, imageShot, videoShot, etc.
      storyboardJson.shots = storyboardJson.shots.map((shot: any) => {
        // Priority: use appearCharacters from AI, then shot.characters, then extracted characters
        let shotCharacters = "";
        if (shot.appearCharacters && Array.isArray(shot.appearCharacters) && shot.appearCharacters.length > 0) {
          shotCharacters = shot.appearCharacters.join(', ');
        } else if (shot.characters && typeof shot.characters === 'string') {
          shotCharacters = shot.characters;
        } else {
          shotCharacters = charactersString;
        }
        
        const updatedShot = {
          ...shot,
          characters: shotCharacters,
        };
        
        // 确保image_prompt存在（新格式应该已经包含）
        // 优先使用直接字段 imageDescription，然后是 imageShot.imageDescription，最后是其他字段
        if (!updatedShot.image_prompt) {
          updatedShot.image_prompt = updatedShot.imageDescription 
            || updatedShot.imageShot?.imageDescription 
            || updatedShot.imagePrompt
            || updatedShot.description 
            || updatedShot.camera_description 
            || "";
        }
        
        // 确保video_prompt存在（新格式应该已经包含）
        // 优先使用直接字段 videoDescription，然后是 videoShot.videoDescription，最后是其他字段
        if (!updatedShot.video_prompt) {
          updatedShot.video_prompt = updatedShot.videoDescription
            || updatedShot.videoShot?.videoDescription
            || updatedShot.videoPrompt
            || updatedShot.image_prompt 
            || updatedShot.description 
            || "";
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
    } else {
      // No shots to process
    }

    // 9. 保存分镜数据到数据库（更新 scene_item 的 metadata）
    // 确保所有shot都包含image_prompt和video_prompt
    if (storyboardJson && storyboardJson.shots && Array.isArray(storyboardJson.shots)) {
      storyboardJson.shots = storyboardJson.shots.map((shot: any, index: number) => {
        // 确保image_prompt和video_prompt都存在
        // 优先使用直接字段 imageDescription，然后是 imageShot.imageDescription，最后是其他字段
        if (!shot.image_prompt) {
          shot.image_prompt = shot.imageDescription 
            || shot.imageShot?.imageDescription 
            || shot.imagePrompt
            || shot.description 
            || "";
        }
        // 优先使用直接字段 videoDescription，然后是 videoShot.videoDescription，最后是其他字段
        if (!shot.video_prompt) {
          shot.video_prompt = shot.videoDescription
            || shot.videoShot?.videoDescription
            || shot.videoPrompt
            || shot.image_prompt 
            || shot.description 
            || "";
        }
        return shot;
      });
    } else {
    }
    
    const updatedMetadata = {
      ...metadata,
      storyboard: storyboardJson, // 保存完整的分镜JSON（包含image_prompt和video_prompt字段）
    };
    const { error: updateError } = await supabase
      .from("anim_scene_items")
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scene_item_id);
    
    // 验证保存是否成功
    if (!updateError) {
      const { data: verifyData, error: verifyError } = await supabase
        .from("anim_scene_items")
        .select("metadata")
        .eq("id", scene_item_id)
        .single();
      
      if (!verifyError && verifyData) {
        const savedMetadata = verifyData.metadata || {};
        const savedStoryboard = savedMetadata.storyboard || null;
      } else {
      }
    }

    if (updateError) {
      return NextResponse.json(
        { success: false, error: `Failed to save storyboard: ${updateError.message}` },
        { status: 500 }
      );
    }

    // 打印生成的分镜结果，方便调试
    if (storyboardJson) {
      console.log("[generate-storyboard] storyboard result:", JSON.stringify(storyboardJson, null, 2));
    } else {
      console.log("[generate-storyboard] storyboard result is empty or undefined");
    }

    return NextResponse.json({
      success: true,
      data: {
        storyboard: storyboardJson,
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

