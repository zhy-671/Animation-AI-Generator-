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

    // 5. 不再需要获取完整故事文本，新格式只需要场次内容

    // 6. 不再需要构建环境信息和详细角色信息，新格式只需要角色名称列表

    // 9. 构建AI提示词（新指令）
    const systemPrompt = `You are a professional cinematic storyboard AI. 

Your task is to convert a scene description and a list of main characters into a structured storyboard JSON.

Instructions:

1. Break the scene into 4-12 shots based on actions, emotions, and key story points.

2. For each shot, generate:

   - shotNumber: sequential number

   - shotDescription: concise description of what is visible (camera angle, character positions, expressions, mood, environment)

   - imagePrompt: detailed prompt for AI image generation (2D/3D anime style, cinematic lighting, weather, atmosphere)

   - videoPrompt: detailed prompt for AI video generation describing camera movement, character motion, and atmosphere

   - narration: natural narration text summarizing story or character thoughts

   - dialogue: spoken lines by characters in this shot (if any)

3. Ensure continuity between shots, showing cause-effect and emotional flow.

4. Accurately reflect scene details: weather, lighting, indoor/outdoor, cityscape, props, clothing, facial expressions.

5. Output: a JSON object with the following structure:

{
  "sceneTitle": "Scene Title Here",
  "shotList": [
    {
      "shotNumber": 1,
      "shotDescription": "",
      "imagePrompt": "",
      "videoPrompt": "",
      "narration": "",
      "dialogue": ""
    },
    {
      "shotNumber": 2,
      "shotDescription": "",
      "imagePrompt": "",
      "videoPrompt": "",
      "narration": "",
      "dialogue": ""
    }
  ]
}

Input variables:
- sceneText: a natural language description of the scene
- characters: an array of main characters in the scene

Example usage:
sceneText = "Old Wang parks his taxi on the side of East Third Ring Road as drizzle turns into light rain. He wipes the steering wheel, tired after working from six a.m. to ten p.m."
characters = ["Old Wang"]

Your output should generate multiple shots, with cinematic visual description, dynamic camera movements, detailed video prompts, narration, and dialogue if present.`;

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
      console.log("场次主要角色字段为空，从场次文本中匹配角色...");
      console.log("场次文本长度:", sceneText.length);
      console.log("场次文本预览:", sceneText.substring(0, 200));
      
      characters.forEach((char: any) => {
        const charName = char.name || char.姓名 || '';
        if (charName) {
          const nameStr = String(charName).trim();
          // 只匹配出现在场次文本中的角色
          if (sceneText && sceneText.includes(nameStr)) {
            sceneCharacterNames.push(nameStr);
            console.log(`  ✓ 在场次文本中匹配到角色: "${nameStr}"`);
          }
        }
      });
      
      if (sceneCharacterNames.length > 0) {
        console.log("从场次文本匹配到的角色:", sceneCharacterNames);
      } else {
        console.log("场次文本中未匹配到任何角色");
      }
    }
    
    // 不再使用方法3（使用所有角色），只使用该场次对应的角色
    if (sceneCharacterNames.length === 0) {
      console.warn("⚠️ 该场次没有找到对应的角色，将使用空数组传递给AI");
    }
    
    console.log("最终传递给AI的场次角色名称:", sceneCharacterNames);

    // 11. 构建系统提示词（新格式不需要替换占位符，直接使用）
    const finalSystemPrompt = systemPrompt;

    // 12. 构建用户提示词（只传入场次内容和角色）
    const sceneStoryText = sceneStory || sceneDescription || "";
    const userPrompt = `Generate storyboard for the following scene:

sceneText: "${sceneStoryText}"

characters: ${JSON.stringify(sceneCharacterNames)}

Please output the JSON object following the exact format specified in the system prompt.`;

    console.log("=== 生成分镜 - AI提示词 ===");
    console.log("System Prompt length:", finalSystemPrompt.length);
    console.log("System Prompt preview (first 1000 chars):", finalSystemPrompt.substring(0, 1000));
    console.log("--- User Prompt 内容 ===");
    console.log("User Prompt:", userPrompt);
    console.log("--- 传递给AI的数据详情 ===");
    console.log("场次内容 (sceneText):");
    console.log("  - sceneStory:", sceneStory || '(空)');
    console.log("  - sceneDescription:", sceneDescription || '(空)');
    console.log("  - 最终使用的 sceneStoryText:", sceneStoryText || '(空)');
    console.log("  - sceneStoryText 长度:", sceneStoryText.length);
    console.log("  - sceneStoryText 完整内容:", sceneStoryText);
    console.log("角色信息 (characters):");
    console.log("  - sceneCharacterNames 数组:", sceneCharacterNames);
    console.log("  - sceneCharacterNames 长度:", sceneCharacterNames.length);
    console.log("  - sceneCharacterNames JSON:", JSON.stringify(sceneCharacterNames));
    console.log("其他信息:");
    console.log("  - Scene Number:", sceneNumber);
    console.log("  - Scene Location:", sceneLocation || '(空)');
    console.log("  - Scene Time:", sceneTime || '(空)');
    console.log("  - Main Characters (原始):", mainCharacters);

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
        console.log("解析后的 storyboardJson 类型:", typeof storyboardJson);
        console.log("解析后的 storyboardJson 是否为数组:", Array.isArray(storyboardJson));
        console.log("解析后的 storyboardJson keys:", storyboardJson ? Object.keys(storyboardJson) : 'null');
        console.log("解析后的 storyboardJson 完整结构预览:", JSON.stringify(storyboardJson).substring(0, 1000));
        
        // 检查是否是数组格式（AI可能直接返回shotList数组）
        if (Array.isArray(storyboardJson)) {
          console.log("⚠️ 检测到数组格式，转换为对象格式...");
          // 如果返回的是数组，转换为对象格式
          storyboardJson = {
            sceneTitle: `Scene ${sceneNumber}`,
            shotList: storyboardJson,
          };
          console.log("转换后的 storyboardJson keys:", Object.keys(storyboardJson));
          console.log("转换后的 shotList 长度:", storyboardJson.shotList?.length || 0);
        }
        
        console.log("解析后的 storyboardJson.shots 类型:", typeof storyboardJson?.shots);
        console.log("解析后的 storyboardJson.shotList 类型:", typeof storyboardJson?.shotList);
        console.log("解析后的 storyboardJson.shots 是否为数组:", Array.isArray(storyboardJson?.shots));
        console.log("解析后的 storyboardJson.shotList 是否为数组:", Array.isArray(storyboardJson?.shotList));
        console.log("解析后的 storyboardJson.shots 长度:", storyboardJson?.shots?.length);
        console.log("解析后的 storyboardJson.shotList 长度:", storyboardJson?.shotList?.length);
        
        if (storyboardJson?.shots?.[0]) {
          console.log("第一个 shot (shots) 的字段:", Object.keys(storyboardJson.shots[0]));
        } else if (storyboardJson?.shotList?.[0]) {
          console.log("第一个 shot (shotList) 的字段:", Object.keys(storyboardJson.shotList[0]));
          console.log("第一个 shot 的 shotNumber:", storyboardJson.shotList[0].shotNumber);
          console.log("第一个 shot 的 imagePrompt:", !!storyboardJson.shotList[0].imagePrompt);
          console.log("第一个 shot 的 videoPrompt:", !!storyboardJson.shotList[0].videoPrompt);
        } else {
          console.error("❌ storyboardJson.shots[0] 和 storyboardJson.shotList[0] 都不存在！");
          console.error("storyboardJson 的值:", storyboardJson);
        }
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

    // 11. 转换新格式到兼容格式
    // 新格式: { sceneTitle, shotList: [{ shotNumber, shotDescription, imagePrompt, videoPrompt, narration, dialogue }] }
    // 兼容格式: { scene_title, scene_summary, shots: [{ shot_number, description, image_prompt, video_prompt, narration, dialogue }] }
    console.log("=== 转换新格式到兼容格式 ===");
    console.log("转换前的 storyboardJson:", {
      type: typeof storyboardJson,
      isNull: storyboardJson === null,
      keys: storyboardJson ? Object.keys(storyboardJson) : [],
      hasShotList: !!storyboardJson?.shotList,
      hasShots: !!storyboardJson?.shots,
      shotListType: typeof storyboardJson?.shotList,
      shotListIsArray: Array.isArray(storyboardJson?.shotList),
      shotListLength: storyboardJson?.shotList?.length,
    });
    
    if (storyboardJson) {
      // 检查是否是新格式（有 shotList）
      if (storyboardJson.shotList && Array.isArray(storyboardJson.shotList)) {
        console.log("检测到新格式（shotList），开始转换...");
        
        // 转换 sceneTitle -> scene_title
        if (storyboardJson.sceneTitle) {
          storyboardJson.scene_title = storyboardJson.sceneTitle;
        } else {
          storyboardJson.scene_title = `Scene ${sceneNumber}`;
        }
        
        // 转换 shotList -> shots，并转换字段名
        storyboardJson.shots = storyboardJson.shotList.map((shot: any) => {
          return {
            shot_number: shot.shotNumber || shot.shot_number || 0,
            description: shot.shotDescription || shot.description || "",
            image_prompt: shot.imagePrompt || shot.image_prompt || "",
            video_prompt: shot.videoPrompt || shot.video_prompt || "",
            narration: shot.narration || "",
            dialogue: shot.dialogue || "",
            // 保留原始字段以便兼容
            ...shot,
          };
        });
        
        // 生成 scene_summary（从第一个shot的narration或description）
        if (!storyboardJson.scene_summary) {
          const firstShot = storyboardJson.shots[0];
          if (firstShot) {
            storyboardJson.scene_summary = firstShot.narration || firstShot.description || storyboardJson.scene_title;
          } else {
            storyboardJson.scene_summary = storyboardJson.scene_title;
          }
        }
        
        // 删除新格式的字段
        delete storyboardJson.shotList;
        delete storyboardJson.sceneTitle;
        
        console.log("转换完成，新格式字段已删除");
      } else if (storyboardJson.shots && Array.isArray(storyboardJson.shots)) {
        // 旧格式，确保有 scene_title 和 scene_summary
        console.log("检测到旧格式（shots），确保兼容字段存在...");
        if (storyboardJson.scene_content && !storyboardJson.scene_summary) {
          storyboardJson.scene_summary = storyboardJson.scene_content;
        }
        if (!storyboardJson.scene_title) {
          const sceneTitleSource = storyboardJson.scene_content || storyboardJson.scene_summary || "";
          storyboardJson.scene_title = sceneTitleSource.substring(0, 50).trim() || `Scene ${sceneNumber}`;
        }
      }
      
      console.log("转换后的 storyboardJson:", {
        hasShots: !!storyboardJson.shots,
        shotsType: typeof storyboardJson.shots,
        shotsIsArray: Array.isArray(storyboardJson.shots),
        shotsLength: storyboardJson.shots?.length,
        scene_title: storyboardJson.scene_title,
        scene_summary: storyboardJson.scene_summary ? storyboardJson.scene_summary.substring(0, 100) : null,
      });
    } else {
      console.error("storyboardJson 为 null 或 undefined，无法转换格式");
    }

    // 12. 为每个shot添加characters字段（从场次的"主要角色"中提取，如果没取到则从数据库角色表匹配）
    console.log("=== 开始为shot添加characters字段 ===");
    console.log("检查 storyboardJson:", {
      isNull: storyboardJson === null,
      isUndefined: storyboardJson === undefined,
      type: typeof storyboardJson,
      keys: storyboardJson ? Object.keys(storyboardJson) : [],
      hasShots: !!storyboardJson?.shots,
      shotsType: typeof storyboardJson?.shots,
      shotsIsArray: Array.isArray(storyboardJson?.shots),
      shotsLength: storyboardJson?.shots?.length,
    });
    
    if (storyboardJson && storyboardJson.shots && Array.isArray(storyboardJson.shots)) {
      console.log("✓ storyboardJson.shots 存在且是数组，开始处理");
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
      console.log("处理后的 storyboardJson.shots 长度:", storyboardJson.shots.length);
      console.log("处理后的 storyboardJson keys:", Object.keys(storyboardJson));
    } else {
      console.error("❌ storyboardJson.shots 不存在或不是数组，无法添加characters字段");
      console.error("storyboardJson:", storyboardJson);
      console.error("storyboardJson.shots:", storyboardJson?.shots);
    }

    // 9. 保存分镜数据到数据库（更新 scene_item 的 metadata）
    // 确保所有shot都包含image_prompt和video_prompt
    console.log("=== 保存分镜数据到数据库前 ===");
    console.log("storyboardJson 检查:", {
      isNull: storyboardJson === null,
      isUndefined: storyboardJson === undefined,
      type: typeof storyboardJson,
      keys: storyboardJson ? Object.keys(storyboardJson) : [],
      hasShots: !!storyboardJson?.shots,
      shotsType: typeof storyboardJson?.shots,
      shotsIsArray: Array.isArray(storyboardJson?.shots),
      shotsLength: storyboardJson?.shots?.length,
    });
    
    if (storyboardJson && storyboardJson.shots && Array.isArray(storyboardJson.shots)) {
      console.log("处理 shots 数组，数量:", storyboardJson.shots.length);
      storyboardJson.shots = storyboardJson.shots.map((shot: any, index: number) => {
        // 确保image_prompt和video_prompt都存在
        if (!shot.image_prompt) {
          console.warn(`Shot ${index + 1} 缺少 image_prompt，使用 description 作为后备`);
          shot.image_prompt = shot.description || "";
        }
        if (!shot.video_prompt) {
          console.warn(`Shot ${index + 1} 缺少 video_prompt，使用 image_prompt 作为后备`);
          shot.video_prompt = shot.image_prompt || shot.description || "";
        }
        return shot;
      });
      console.log("处理后的 shots 数组长度:", storyboardJson.shots.length);
    } else {
      console.error("storyboardJson 或 shots 无效:", {
        hasStoryboardJson: !!storyboardJson,
        hasShots: !!storyboardJson?.shots,
        shotsIsArray: Array.isArray(storyboardJson?.shots),
      });
    }
    
    const updatedMetadata = {
      ...metadata,
      storyboard: storyboardJson, // 保存完整的分镜JSON（包含image_prompt和video_prompt字段）
    };
    
    console.log("=== 保存到数据库的分镜数据 ===");
    console.log("保存前的 metadata keys:", Object.keys(metadata));
    console.log("保存前的 metadata.storyboard:", metadata.storyboard ? '存在' : '不存在');
    console.log("要保存的 storyboardJson keys:", storyboardJson ? Object.keys(storyboardJson) : []);
    console.log("要保存的 storyboardJson.shots 数量:", storyboardJson?.shots?.length || 0);
    console.log("保存后的 updatedMetadata keys:", Object.keys(updatedMetadata));
    console.log("保存后的 updatedMetadata.storyboard keys:", updatedMetadata.storyboard ? Object.keys(updatedMetadata.storyboard) : []);
    console.log("保存后的 updatedMetadata.storyboard.shots 数量:", updatedMetadata.storyboard?.shots?.length || 0);
    console.log("保存到数据库的分镜数据预览:", {
      scene_title: storyboardJson?.scene_title,
      shots_count: storyboardJson?.shots?.length,
      first_shot_fields: storyboardJson?.shots?.[0] ? Object.keys(storyboardJson.shots[0]) : [],
      first_shot_has_image_prompt: !!storyboardJson?.shots?.[0]?.image_prompt,
      first_shot_has_video_prompt: !!storyboardJson?.shots?.[0]?.video_prompt,
      fullStoryboardKeys: storyboardJson ? Object.keys(storyboardJson) : [],
      fullStoryboardString: storyboardJson ? JSON.stringify(storyboardJson).substring(0, 500) : 'null',
    });
    console.log("完整的 updatedMetadata.storyboard:", JSON.stringify(updatedMetadata.storyboard, null, 2).substring(0, 2000));

    const { error: updateError } = await supabase
      .from("anim_scene_items")
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scene_item_id);
    
    // 验证保存是否成功
    if (!updateError) {
      console.log("✅ 数据库更新成功，验证保存的数据...");
      const { data: verifyData, error: verifyError } = await supabase
        .from("anim_scene_items")
        .select("metadata")
        .eq("id", scene_item_id)
        .single();
      
      if (!verifyError && verifyData) {
        const savedMetadata = verifyData.metadata || {};
        const savedStoryboard = savedMetadata.storyboard || null;
        console.log("验证保存的数据:", {
          hasMetadata: !!savedMetadata,
          hasStoryboard: !!savedStoryboard,
          storyboardKeys: savedStoryboard ? Object.keys(savedStoryboard) : [],
          shotsCount: savedStoryboard?.shots?.length || 0,
          shotsIsArray: Array.isArray(savedStoryboard?.shots),
          firstShotKeys: savedStoryboard?.shots?.[0] ? Object.keys(savedStoryboard.shots[0]) : [],
        });
        console.log("保存的完整 storyboard 预览:", savedStoryboard ? JSON.stringify(savedStoryboard).substring(0, 1000) : 'null');
      } else {
        console.error("验证保存数据时出错:", verifyError);
      }
    }

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

