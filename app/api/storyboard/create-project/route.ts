import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * API Route: 创建项目并生成故事大纲和角色信息
 * 调用 DashScope Chat Completions API 生成结构化的故事大纲和角色信息
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
    const { story_text, project_id } = body;

    if (!story_text || typeof story_text !== "string" || !story_text.trim()) {
      return NextResponse.json(
        { success: false, error: "story_text is required" },
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

    // 构建提示词
    const systemPrompt = `You are a professional anime and cinematic screenwriter and character designer. 

Based on the following story text, generate a **complete story outline** and **extremely detailed character information** suitable for animation or cinematic adaptation.

INSTRUCTIONS:

1. Generate a **story outline**:

   - title
   - theme
   - summary (3–5 sentences)
   - chapters (up to 5 chapters)
     - For each chapter:
       - chapter_number
       - chapter_title
       - chapter_summary (50–100 words)
       - key_events (3–5 key events per chapter, briefly described)
       - major_conflicts

2. Generate a **detailed character list** for all major and supporting characters. For each character, provide extremely detailed information to facilitate AI image generation:

   - id (unique identifier for reference)
   - name
   - role (protagonist, antagonist, side character, mentor, etc.)
   - age
   - gender
   - appearance:
       - ethnicity, height, body type, weight
       - face shape, eyes (shape, color, size), eyebrows (shape, color)
       - nose, lips, ears, teeth, distinguishing facial features
       - skin tone, scars, freckles, tattoos, birthmarks
       - hair color, hair style, length, texture
       - posture, typical gestures, expressions
   - clothing style:
       - typical outfits, colors, accessories, shoes
       - functional details (pockets, belts, gloves, tools)
       - consistency with character's occupation, personality, or story setting
   - personality traits
   - background and motivations
   - relationships with other characters
   - special traits, identifiers, or props (items, voice style, habits)
   - **visual_reference_prompt**: a detailed AI-friendly prompt describing the character including posture, expression, clothing, hairstyle, mood, lighting, environment cues—enough to generate consistent images across scenes
   - preferred_art_style (choose from: realistic 3D anime, healing slice-of-life, urban romance, Western comic style, cyberpunk, watercolor fantasy, Ghibli-style healing)

3. Ensure all characters' **visual_reference_prompt and preferred_art_style** are sufficient to generate **consistent AI images** across multiple scenes, preserving posture, expression, clothing, hairstyle, and mood.

4. Output strictly in **JSON format** with the following structure:

{
  "title": "",
  "theme": "",
  "summary": "",
  "chapters": [
    {
      "chapter_number": 1,
      "chapter_title": "",
      "chapter_summary": "",
      "key_events": ["", "", ""],
      "major_conflicts": ""
    }
  ],
  "characters": [
    {
      "id": "",
      "name": "",
      "role": "",
      "age": "",
      "gender": "",
      "appearance": "",
      "clothing_style": "",
      "personality_traits": "",
      "background": "",
      "relationships": "",
      "special_traits": "",
      "visual_reference_prompt": "",
      "preferred_art_style": ""
    }
  ]
}

**Requirements**:
- Character descriptions must be as detailed as possible, including physical features, clothing, posture, typical gestures, and expressions.
- Include both major and supporting characters.
- The JSON must be valid and strictly follow the specified structure.`;

    const userPrompt = `STORY:

${story_text.trim()}

Please generate the complete story outline and detailed character information according to the instructions above.`;

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

    // 清理和解析 JSON
    let cleanedJson = rawContent.trim();

    // 移除 markdown 代码块标记
    if (cleanedJson.startsWith("```json")) {
      cleanedJson = cleanedJson.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
    } else if (cleanedJson.startsWith("```")) {
      cleanedJson = cleanedJson.replace(/^```\s*/, "").replace(/```\s*$/, "");
    }

    cleanedJson = cleanedJson.trim();

    // 清理函数：移除字段值中的括号注释（例如 "age": 16 (at time of death) -> "age": 16）
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
            // 字符串值结束，检查后面是否有括号注释
            let j = i + 1;
            while (j < jsonStr.length && /\s/.test(jsonStr[j])) j++;
            if (j < jsonStr.length && jsonStr[j] === '(') {
              // 找到括号注释，跳过直到匹配的右括号
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
        
        // 不在字符串中，检查是否在值区域
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
        
        // 如果在值区域且遇到左括号，可能是注释
        if (inValue && char === '(') {
          // 检查前面是否是数字或字符串结束
          let lookBack = result.length - 1;
          while (lookBack >= 0 && /\s/.test(result[lookBack])) lookBack--;
          if (lookBack >= 0 && (/\d/.test(result[lookBack]) || result[lookBack] === '"')) {
            // 跳过括号注释
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

    // 清理函数：替换中文引号和控制字符，修复未转义的引号
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
            // 字符串开始
            inString = true;
            stringStart = i;
            result += char;
            continue;
          } else {
            // 在字符串内遇到引号，需要判断是否是字符串结束
            // 向前查找，看是否有未转义的引号对
            let j = i + 1;
            // 跳过空白字符
            while (j < str.length && /\s/.test(str[j])) j++;
            
            // 检查后面是否是有效的 JSON 结构字符
            if (j < str.length && (str[j] === ',' || str[j] === '}' || str[j] === ']')) {
              // 这是字符串结束
              inString = false;
              result += char;
              continue;
            } else if (j < str.length && str[j] === ':') {
              // 后面是冒号，可能是对象键的结束，也可能是字符串内的内容
              // 检查前面是否有冒号（说明这是值）
              let k = stringStart - 1;
              while (k >= 0 && /\s/.test(str[k])) k--;
              if (k >= 0 && str[k] === ':') {
                // 这是值中的引号，需要转义
                result += '\\"';
                continue;
              } else {
                // 这是键的结束
                inString = false;
                result += char;
                continue;
              }
            } else {
              // 可能是字符串内的引号，转义它
              result += '\\"';
              continue;
            }
          }
        }
        
        if (inString) {
          // 在字符串内，替换中文引号为转义的标准引号
          if (char === '\u201C' || char === '\u201D') {
            result += '\\"';
          } else if (char === '\u2018' || char === '\u2019') {
            result += "\\'";
          } else if (char === '\n') {
            result += '\\n';
          } else if (char === '\r') {
            result += '\\r';
          } else if (char === '\t') {
            result += '\\t';
          } else if (char.charCodeAt(0) < 32 && char !== '\n' && char !== '\r' && char !== '\t') {
            result += `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
          } else {
            result += char;
          }
        } else {
          // 字符串外，移除多余的换行和制表符
          if (char === '\n' || char === '\r') {
            result += ' ';
          } else if (char === '\t') {
            result += ' ';
          } else {
            result += char;
          }
        }
      }
      
      return result;
    }
    
    // 额外的 JSON 修复函数：尝试修复常见的 JSON 错误
    function fixJsonErrors(jsonStr: string): string {
      // 修复未转义的换行符（在字符串值中）
      jsonStr = jsonStr.replace(/([^\\]|^)"([^"]*)\n([^"]*)"([^\\]|$)/g, (match, before, part1, part2, after) => {
        return `${before}"${part1}\\n${part2}"${after}`;
      });
      
      // 修复未转义的回车符
      jsonStr = jsonStr.replace(/([^\\]|^)"([^"]*)\r([^"]*)"([^\\]|$)/g, (match, before, part1, part2, after) => {
        return `${before}"${part1}\\r${part2}"${after}`;
      });
      
      // 修复数组元素后缺少逗号的情况（在数组内部，不在字符串中）
      // 匹配模式：值后跟换行/空格，然后是引号或数字或布尔值或null或{或[，但没有逗号
      jsonStr = jsonStr.replace(/([\]\}])\s*"([^"]+)":/g, '$1, "$2":'); // 对象后跟键
      jsonStr = jsonStr.replace(/([\]\}])\s*\{/g, '$1, {'); // 对象后跟对象
      jsonStr = jsonStr.replace(/([\]\}])\s*\[/g, '$1, ['); // 对象后跟数组
      
      // 修复数组元素后缺少逗号（更精确的匹配）
      // 匹配：值（字符串、数字、布尔、null、对象、数组）后跟空格和另一个值，但没有逗号
      jsonStr = jsonStr.replace(/(["\d\w\]\}])\s+("|\d|true|false|null|\{|\[)/g, '$1, $2');
      
      // 修复数组元素后缺少逗号（在数组内部）
      // 匹配：数组元素（字符串、数字、布尔、null、对象、数组）后跟换行和另一个元素
      jsonStr = jsonStr.replace(/(["\d\w\]\}])\s*\n\s*("|\d|true|false|null|\{|\[)/g, '$1,\n$2');
      
      // 修复对象属性后缺少逗号
      jsonStr = jsonStr.replace(/(")\s*\n\s*(")/g, '$1,\n$2');
      
      // 修复字符串值中的未转义引号（但不在字符串边界）
      // 这是一个更复杂的修复，需要小心处理
      
      return jsonStr;
    }

    // 尝试解析 JSON
    let parsedData: any;
    try {
      parsedData = JSON.parse(cleanedJson);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw content preview:", rawContent.substring(0, 500));
      
      // 第一层修复：移除括号注释
      try {
        cleanedJson = removeCommentsInValues(cleanedJson);
        parsedData = JSON.parse(cleanedJson);
        console.log("Successfully parsed after removing comments");
      } catch (secondError) {
        console.error("Second parse attempt failed:", secondError);
        
        // 第二层修复：清理控制字符和中文引号
        try {
          cleanedJson = cleanJsonString(cleanedJson);
          parsedData = JSON.parse(cleanedJson);
          console.log("Successfully parsed after cleaning string");
        } catch (thirdError) {
          console.error("Third parse attempt failed:", thirdError);
          
          // 第三层修复：使用额外的 JSON 错误修复
          try {
            cleanedJson = fixJsonErrors(cleanedJson);
            parsedData = JSON.parse(cleanedJson);
            console.log("Successfully parsed after fixing JSON errors");
          } catch (fourthError) {
            console.error("Fourth parse attempt failed:", fourthError);
            
            // 尝试提取错误位置信息
            let errorPosition = 4252; // 默认位置
            let errorLine = 115; // 默认行号
            let errorColumn = 23; // 默认列号
            
            if (fourthError instanceof SyntaxError) {
              const errorMsg = fourthError.message;
              const positionMatch = errorMsg.match(/position (\d+)/);
              const lineMatch = errorMsg.match(/line (\d+)/);
              const columnMatch = errorMsg.match(/column (\d+)/);
              
              if (positionMatch) errorPosition = parseInt(positionMatch[1]);
              if (lineMatch) errorLine = parseInt(lineMatch[1]);
              if (columnMatch) errorColumn = parseInt(columnMatch[1]);
            }
            
            // 显示错误位置附近的内容
            const startPos = Math.max(0, errorPosition - 200);
            const endPos = Math.min(cleanedJson.length, errorPosition + 200);
            const errorContext = cleanedJson.substring(startPos, endPos);
            
            console.error("Error position:", errorPosition, `(line ${errorLine}, column ${errorColumn})`);
            console.error("Error context:", errorContext);
            console.error("Cleaned JSON length:", cleanedJson.length);
            console.error("Cleaned JSON preview (first 1000 chars):", cleanedJson.substring(0, 1000));
            console.error("Cleaned JSON preview (last 1000 chars):", cleanedJson.substring(Math.max(0, cleanedJson.length - 1000)));
            
            // 尝试最后一次修复：使用更激进的修复策略
            try {
              // 尝试修复常见的数组错误
              let finalJson = cleanedJson;
              
              // 修复数组元素之间缺少逗号（更激进的模式）
              finalJson = finalJson.replace(/([\]\}])\s*\n\s*("|\d|true|false|null|\{|\[)/g, '$1,\n$2');
              finalJson = finalJson.replace(/(["\d\w\]\}])\s+("|\d|true|false|null|\{|\[)/g, '$1, $2');
              
              // 尝试解析
              parsedData = JSON.parse(finalJson);
              console.log("Successfully parsed after aggressive JSON fixing");
            } catch (fifthError) {
              console.error("Fifth parse attempt (aggressive fix) also failed:", fifthError);
              
              return NextResponse.json(
                {
                  success: false,
                  error: `Failed to parse JSON: ${fourthError instanceof Error ? fourthError.message : "Unknown error"}`,
                  errorPosition,
                  errorLine,
                  errorColumn,
                  errorContext: errorContext.substring(0, 500),
                  rawContentPreview: rawContent.substring(0, 1000),
                },
                { status: 500 }
              );
            }
          }
        }
      }
    }

    // 验证解析后的数据结构
    if (!parsedData.title || !parsedData.characters || !Array.isArray(parsedData.characters)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid data structure returned from API",
          parsedData,
        },
        { status: 500 }
      );
    }

    // 保存到数据库 - 使用新的多表结构
    let projectId = project_id;
    const projectTitle = parsedData.title || "Untitled Project";
    const storyTitle = parsedData.title || "Untitled Story";
    
    // 提取角色信息
    const characters = parsedData.characters || [];
    // 提取故事大纲（不包含characters）
    const { characters: _, ...storyOutlineWithoutChars } = parsedData;
    const storyOutline = storyOutlineWithoutChars;

    console.log("=== 保存到数据库 - 数据结构 ===");
    console.log("parsedData keys:", Object.keys(parsedData));
    console.log("parsedData.title:", parsedData.title);
    console.log("parsedData.theme:", parsedData.theme);
    console.log("parsedData.summary:", parsedData.summary?.substring(0, 100));
    console.log("parsedData.chapters:", parsedData.chapters ? `exists (${parsedData.chapters.length} items)` : "null");
    console.log("parsedData.characters:", parsedData.characters ? `exists (${parsedData.characters.length} items)` : "null");
    console.log("---");
    console.log("storyOutline keys (保存到 story_outline 字段):", Object.keys(storyOutline));
    console.log("storyOutline.theme:", storyOutline.theme);
    console.log("storyOutline.summary:", storyOutline.summary?.substring(0, 100));
    console.log("storyOutline.chapters:", storyOutline.chapters ? `exists (${storyOutline.chapters.length} items)` : "null");
    console.log("---");
    console.log("characters (保存到 characters 字段):", characters.length, "items");
    console.log("characters preview:", characters.slice(0, 2).map((c: any) => ({
      id: c.id,
      name: c.name,
      age: c.age,
      gender: c.gender,
    })));
    console.log("================================");

    console.log("Saving project to database, projectId:", projectId, "userId:", user.id);

    // 1. 创建或更新项目主表
    if (projectId) {
      // 更新现有项目
      const { data: updatedProject, error: updateError } = await supabase
        .from("anim_storyboard_projects")
        .update({
          title: projectTitle,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating project:", updateError);
        
        // 如果项目不存在（PGRST116），创建新项目
        if (updateError.code === 'PGRST116' || updateError.message?.includes('0 rows')) {
          console.log("Project not found, creating new project instead");
          projectId = null; // 重置 projectId，让下面的代码创建新项目
        } else {
          return NextResponse.json(
            {
              success: false,
              error: `Failed to update project: ${updateError.message}`,
            },
            { status: 500 }
          );
        }
      } else if (updatedProject) {
        projectId = updatedProject.id;
        console.log("Project updated successfully:", projectId);
      }
    }
    
    // 如果没有 projectId 或更新失败（项目不存在），创建新项目
    if (!projectId) {
      // 创建新项目主表
      // 注意：content 字段在新结构中已移至 anim_story_scripts 表
      // 这里提供一个空字符串作为临时兼容（如果迁移尚未运行，content 列仍为 NOT NULL）
      const { data: newProject, error: insertError } = await supabase
        .from("anim_storyboard_projects")
        .insert({
          user_id: user.id,
          title: projectTitle,
          content: "", // 临时兼容：空字符串，实际内容存储在 anim_story_scripts 表中
          status_script: true, // 故事剧本步骤完成
          status_settings: false, // 设置步骤未完成
          status_storyboard: false, // 分镜步骤未完成
          status_video: false, // 制作视频步骤未完成
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating project:", insertError);
        return NextResponse.json(
          {
            success: false,
            error: `Failed to create project: ${insertError.message}`,
          },
          { status: 500 }
        );
      }

      if (!newProject || !newProject.id) {
        console.error("Project created but no ID returned:", newProject);
        return NextResponse.json(
          {
            success: false,
            error: "Project created but failed to get project ID",
          },
          { status: 500 }
        );
      }

      projectId = newProject.id;
      console.log("Project created successfully with ID:", projectId);
    }

    // 2. 保存故事文本到 anim_story_scripts 表（upsert）
    const { error: scriptError } = await supabase
      .from("anim_story_scripts")
      .upsert({
        project_id: projectId,
        title: storyTitle,
        content: story_text, // 保存完整的原始故事文本
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id'
      });

    if (scriptError) {
      console.error("Error saving story script:", scriptError);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to save story script: ${scriptError.message}`,
        },
        { status: 500 }
      );
    }
    console.log("Story script saved successfully");

    // 3. 保存故事大纲和角色信息到 anim_story_outlines 表（upsert）
    console.log("=== 保存到 anim_story_outlines 表 ===");
    console.log("story_outline 字段内容:", JSON.stringify(storyOutline, null, 2).substring(0, 500));
    console.log("characters 字段内容:", JSON.stringify(characters, null, 2).substring(0, 500));
    
    const { error: outlineError } = await supabase
      .from("anim_story_outlines")
      .upsert({
        project_id: projectId,
        story_outline: storyOutline, // 包含 theme, summary, chapters（不包含 characters）
        characters: characters, // 角色数组
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id'
      });

    if (outlineError) {
      console.error("Error saving story outline:", outlineError);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to save story outline: ${outlineError.message}`,
        },
        { status: 500 }
      );
    }
    console.log("Story outline and characters saved successfully");
    console.log("保存的 story_outline 字段包含:", Object.keys(storyOutline));
    console.log("保存的 characters 字段包含:", characters.length, "个角色");

    return NextResponse.json({
      success: true,
      data: {
        project_id: projectId,
        story_outline: parsedData, // 保持向后兼容，返回完整数据
      },
    });
  } catch (error) {
    console.error("Error in create-project API:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

