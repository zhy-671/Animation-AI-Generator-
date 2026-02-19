import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * API Route: 生成故事大纲
 * 调用 DashScope Chat Completions API 生成结构化的故事大纲
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
    const { userText } = body;

    if (!userText || typeof userText !== "string" || !userText.trim()) {
      return NextResponse.json(
        { success: false, error: "userText is required" },
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

    // // 验证 API 密钥格式（通常 DashScope API 密钥以 sk- 开头）
    // if (!apiKey.startsWith('sk-') && apiKey.length < 20) {
    // }

    // ========== 使用 Laozhang API 调用 ==========
    // 使用 Laozhang API Key
    const apiKey = process.env.LAOZHANG_API_KEY_STORY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "LAOZHANG_API_KEY_STORY is not configured" },
        { status: 500 }
      );
    }

    // 构建提示词
    const systemPrompt = `LANGUAGE REQUIREMENT (CRITICAL): All output content MUST be in English only. No Chinese, Japanese, or any other non-English characters in the generated content. All field values (title, theme, character names, descriptions, etc.) must be in English.

You are a professional story planner and anime scriptwriter specializing in Western/international settings and character design. 

Based on the user's input text, automatically determine the story's style, tone, and genre (e.g., fantasy, sci-fi, adventure, mystery, romance, children's, or emotional/poetic). 

Then generate a **complete story outline** and **detailed character information** suitable for animation, illustrated story, or storyboard creation.

**IMPORTANT REQUIREMENTS:**

1. **Setting and Scenes**: All story settings, locations, and scenes must be appropriate for Western/international contexts (e.g., Western cities, European architecture, American suburbs, international schools, Western-style environments). Avoid Eastern/Asian-specific cultural elements unless explicitly requested.

2. **Character Names**: All character names must be Western/international names (e.g., English, European, or international names like "Emma", "James", "Sophia", "Michael", "Olivia", "David", etc.). Do not use Eastern/Asian names unless explicitly specified in the user input.

3. **Character Appearance**: All characters must have Western/international facial features and appearance characteristics:
   - Facial features: Western facial structure (e.g., defined cheekbones, varied eye shapes typical of Western ethnicities, Western nose shapes)
   - Skin tones: Diverse Western/international skin tones (Caucasian, Mediterranean, Latin American, African American, etc.)
   - Hair: Natural Western hair colors and styles (blonde, brown, black, red, auburn, etc.)
   - Eye colors: Common Western eye colors (blue, green, brown, hazel, gray, etc.)
   - Body types: Diverse Western body types and builds

4. Automatically detect story style, tone, and genre from the input text.

5. Generate a **structured story outline in JSON format**, including:
   - title
   - theme
   - genre
   - summary
   - setting (time/place/atmosphere - must be Western/international setting)
   - plot_outline (4-6 key scenes forming a full narrative arc)
   - tone_style (detected tone and narrative style)
   - message (central idea or lesson)

6. Extract all important characters and generate **extremely detailed JSON for each character**, including:
   - id (unique identifier)
   - name (MUST be a Western/international name)
   - role (Protagonist, Supporting, etc.)
   - age
   - gender
   - appearance: hair color, eye color, hair style, height, build, skin tone, facial features (Western/international features), distinct marks
   - clothing: style, accessories, footwear (appropriate for Western/international settings)
   - personality traits
   - background / backstory
   - skills and abilities
   - relationships with other characters
   - visual_reference_prompt (for AI image generation, must describe Western/international facial features and appearance, consistent style across all scenes)
   - pose_references for key scenes (optional, for storyboard guidance)

**Notes for AI:**
- Ensure JSON is valid and parsable.
- Story tone, genre, and character style should be coherent and cinematic.
- All settings, scenes, and character appearances must reflect Western/international contexts.
- Character names must be Western/international names.
- Character visual descriptions must emphasize Western/international facial features and appearance.
- Character info will be used by users to generate reference images; consistency must be maintained across all scenes.
- Plot outline scenes should reference characters, but character images are not generated at this stage—only provide prompts and detailed descriptions for later use.
- **LANGUAGE REQUIREMENT**: All output must be in English only. Do not include any Chinese characters or translations in the JSON output.`;

    const userPrompt = `**User Input:** "${userText.trim()}"

**Output JSON structure:**

{
  "story": {
    "title": "",
    "theme": "",
    "genre": "",
    "summary": "",
    "setting": "",
    "plot_outline": [
      {"scene": 1, "summary": ""},
      {"scene": 2, "summary": ""},
      {"scene": 3, "summary": ""},
      {"scene": 4, "summary": ""}
    ],
    "tone_style": "",
    "message": ""
  },
  "characters": [
    {
      "id": "",
      "name": "",
      "role": "",
      "age": "",
      "gender": "",
      "appearance": {
        "hair_color": "",
        "eye_color": "",
        "hair_style": "",
        "height": "",
        "build": "",
        "skin_tone": "",
        "facial_features": "",
        "distinct_marks": ""
      },
      "clothing": {
        "style": "",
        "accessories": "",
        "footwear": ""
      },
      "personality": "",
      "background": "",
      "skills_abilities": [],
      "relationships": [],
      "visual_reference_prompt": "",
      "pose_references": []
    }
  ]
}`;

    // ========== 原来的 DashScope API 调用（已注释） ==========
    // // 调用 DashScope Chat Completions API（使用中国端点，与其他功能保持一致）
    // // 如果您的 API 密钥是国际版的，请将下面的 URL 改为：
    // // "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions"
    // const response = await fetch(
    //   "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    //   {
    //     method: "POST",
    //     headers: {
    //       Authorization: `Bearer ${apiKey}`,
    //       "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify({
    //       model: "qwen-plus", // 使用 qwen-plus 模型
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
    //       max_tokens: 4000,
    //     }),
    //   }
    // );

    // if (!response.ok) {
    //   const errorText = await response.text();
    //   // 如果是 401 错误，提供更详细的错误信息
    //   if (response.status === 401) {
    //     return NextResponse.json(
    //       {
    //         success: false,
    //         error: "API key authentication failed. Please check your DASHSCOPE_API_KEY environment variable.",
    //         details: errorText,
    //       },
    //       { status: 401 }
    //     );
    //   }
      
    //   return NextResponse.json(
    //     {
    //       success: false,
    //       error: `DashScope API error: ${response.status} - ${errorText}`,
    //     },
    //     { status: response.status }
    //   );
    // }

    // const data = await response.json();

    // // DashScope Chat Completions API 返回格式：
    // // {
    // //   "choices": [
    // //     {
    // //       "message": {
    // //         "role": "assistant",
    // //         "content": "..."
    // //       }
    // //     }
    // //   ]
    // // }
    // const content = data.choices?.[0]?.message?.content || "";

    // if (!content) {
    //   return NextResponse.json(
    //     { success: false, error: "No content in DashScope response" },
    //     { status: 500 }
    //   );
    // }
    // ========== 原来的 DashScope API 调用结束 ==========

    // ========== 新的豆包 API 调用 ==========
    // 构建请求参数（使用 OpenAI 兼容格式）
    const requestBody = {
      model: "gpt-4o-mini",
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
      max_tokens: 4000,
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
          status: 500, // Always return 500 for API errors, not the upstream status
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

    // 提取返回内容（Laozhang API 返回格式与 OpenAI 兼容）
    const content = data.choices?.[0]?.message?.content || "";

    if (!content) {
      return NextResponse.json(
        { success: false, error: "No content in Laozhang API response" },
        { status: 500 }
      );
    }
    // ========== 新的豆包 API 调用结束 ==========

    // 清理和修复 JSON 字符串中的控制字符和格式问题
    function cleanJsonString(str: string): string {
      let result = '';
      let inString = false;
      let escapeNext = false;
      
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
          inString = !inString;
          result += char;
          continue;
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

    // 修复数组格式问题
    function fixArrayFormatting(json: string): string {
      let result = '';
      let inString = false;
      let escapeNext = false;
      let lastNonWhitespace = '';
      let bracketDepth = 0;
      let braceDepth = 0;
      
      for (let i = 0; i < json.length; i++) {
        const char = json[i];
        const nextChar = i < json.length - 1 ? json[i + 1] : '';
        
        if (escapeNext) {
          result += char;
          escapeNext = false;
          if (!/\s/.test(char)) lastNonWhitespace = char;
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
          if (!/\s/.test(char)) lastNonWhitespace = char;
          continue;
        }
        
        if (!inString) {
          // 更新括号深度
          if (char === '{') braceDepth++;
          if (char === '}') braceDepth--;
          if (char === '[') bracketDepth++;
          if (char === ']') bracketDepth--;
          
          // 修复数组格式问题
          if (char === '[' && lastNonWhitespace === ']') {
            const trimmed = result.trimEnd();
            if (!trimmed.endsWith(',') && !trimmed.endsWith('[')) {
              result = trimmed + ', ';
            }
          } else if (char === '{' && lastNonWhitespace === '}') {
            const trimmed = result.trimEnd();
            if (!trimmed.endsWith(',') && !trimmed.endsWith('[') && !trimmed.endsWith('{')) {
              result = trimmed + ', ';
            }
          }
          
          // 移除多余的换行和制表符
          if (char === '\n' || char === '\r') {
            if (nextChar === ' ' || nextChar === '\t') {
              continue;
            }
            result += ' ';
          } else if (char === '\t') {
            result += ' ';
          } else {
            result += char;
            if (!/\s/.test(char)) lastNonWhitespace = char;
          }
        } else {
          result += char;
          if (!/\s/.test(char)) lastNonWhitespace = char;
        }
      }
      
      return result;
    }

    // 提取 JSON 内容
    let jsonContent = content.trim();
    
    // 移除可能的 markdown 代码块标记
    if (jsonContent.startsWith("```json")) {
      jsonContent = jsonContent.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    
    // 提取 JSON 对象（找到第一个 { 和最后一个 }）
    let jsonString = "";
    let braceCount = 0;
    let startIndex = -1;
    let endIndex = -1;
    
    for (let i = 0; i < jsonContent.length; i++) {
      const char = jsonContent[i];
      if (char === '{') {
        if (startIndex === -1) startIndex = i;
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && startIndex !== -1) {
          endIndex = i;
          break;
        }
      }
    }
    
    if (startIndex !== -1 && endIndex !== -1) {
      jsonString = jsonContent.substring(startIndex, endIndex + 1);
    } else {
      // 如果找不到完整的对象，尝试使用正则匹配
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }
    }
    
    if (!jsonString) {
      return NextResponse.json(
        {
          success: false,
          error: "No JSON found in response",
          rawContent: content.substring(0, 500),
        },
        { status: 500 }
      );
    }

    // 尝试解析 JSON 内容
    let storyOutline;
    try {
      // 尝试直接解析
      storyOutline = JSON.parse(jsonString);
    } catch (e) {
      // 如果直接解析失败，清理控制字符后重试
      try {
        const cleanedJson = cleanJsonString(jsonString);
        storyOutline = JSON.parse(cleanedJson);
      } catch (secondError) {
        // 如果还是失败，尝试修复数组格式问题
        try {
          let fixedJson = cleanJsonString(jsonString);
          fixedJson = fixArrayFormatting(fixedJson);
          
          // 使用正则表达式修复常见的数组格式问题
          fixedJson = fixedJson.replace(/("\s*)\]\s*"/g, '$1], "');
          fixedJson = fixedJson.replace(/"\s*\]\s*\[/g, '"], [');
          fixedJson = fixedJson.replace(/"\s*\]\s*\{/g, '"], {');
          fixedJson = fixedJson.replace(/\}\s*\]\s*\[/g, '}], [');
          fixedJson = fixedJson.replace(/\}\s*\]\s*\{/g, '}], {');
          fixedJson = fixedJson.replace(/\}\s*\{/g, '}, {');
          fixedJson = fixedJson.replace(/\]\s*\[/g, '], [');
          
          storyOutline = JSON.parse(fixedJson);
        } catch (thirdError) {
          return NextResponse.json(
            {
              success: false,
              error: "Failed to parse JSON from response",
              rawContent: content.substring(0, 1000),
            },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: storyOutline,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to generate story outline",
      },
      { status: 500 }
    );
  }
}

