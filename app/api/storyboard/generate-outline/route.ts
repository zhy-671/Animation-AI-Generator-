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

    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      console.error("DASHSCOPE_API_KEY is not configured in environment variables");
      return NextResponse.json(
        { success: false, error: "DASHSCOPE_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // 验证 API 密钥格式（通常 DashScope API 密钥以 sk- 开头）
    if (!apiKey.startsWith('sk-') && apiKey.length < 20) {
      console.warn("DASHSCOPE_API_KEY format may be incorrect. Expected format: sk-...");
    }

    // 构建提示词
    const systemPrompt = `You are a professional story planner and anime scriptwriter. 

Based on the user's input text, automatically determine the story's style, tone, and genre (e.g., fantasy, sci-fi, adventure, mystery, romance, children's, or emotional/poetic). 

Then generate a **complete story outline** and **detailed character information** suitable for animation, illustrated story, or storyboard creation.

Requirements:

1. Automatically detect story style, tone, and genre from the input text.

2. Generate a **structured story outline in JSON format**, including:
   - title
   - theme
   - genre
   - summary
   - setting (time/place/atmosphere)
   - plot_outline (4-6 key scenes forming a full narrative arc)
   - tone_style (detected tone and narrative style)
   - message (central idea or lesson)

3. Extract all important characters and generate **extremely detailed JSON for each character**, including:
   - id (unique identifier)
   - name
   - role (Protagonist, Supporting, etc.)
   - age
   - gender
   - appearance: hair color, eye color, hair style, height, build, skin tone, facial features, distinct marks
   - clothing: style, accessories, footwear
   - personality traits
   - background / backstory
   - skills and abilities
   - relationships with other characters
   - visual_reference_prompt (for AI image generation, consistent style across all scenes)
   - pose_references for key scenes (optional, for storyboard guidance)

**Notes for AI:**
- Ensure JSON is valid and parsable.
- Story tone, genre, and character style should be coherent and cinematic.
- Character info will be used by users to generate reference images; consistency must be maintained across all scenes.
- Plot outline scenes should reference characters, but character images are not generated at this stage—only provide prompts and detailed descriptions for later use.`;

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

    // 调用 DashScope Chat Completions API（使用中国端点，与其他功能保持一致）
    // 如果您的 API 密钥是国际版的，请将下面的 URL 改为：
    // "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions"
    const response = await fetch(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen-plus", // 使用 qwen-plus 模型
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
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DashScope API error:", {
        status: response.status,
        error: errorText,
        apiKeyPrefix: apiKey ? `${apiKey.substring(0, 10)}...` : "missing",
        endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      });
      
      // 如果是 401 错误，提供更详细的错误信息
      if (response.status === 401) {
        return NextResponse.json(
          {
            success: false,
            error: "API key authentication failed. Please check your DASHSCOPE_API_KEY environment variable.",
            details: errorText,
          },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        {
          success: false,
          error: `DashScope API error: ${response.status} - ${errorText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // DashScope Chat Completions API 返回格式：
    // {
    //   "choices": [
    //     {
    //       "message": {
    //         "role": "assistant",
    //         "content": "..."
    //       }
    //     }
    //   ]
    // }
    const content = data.choices?.[0]?.message?.content || "";

    if (!content) {
      return NextResponse.json(
        { success: false, error: "No content in DashScope response" },
        { status: 500 }
      );
    }

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
      console.warn("First JSON parse attempt failed, cleaning control characters:", e);
      
      try {
        const cleanedJson = cleanJsonString(jsonString);
        storyOutline = JSON.parse(cleanedJson);
      } catch (secondError) {
        // 如果还是失败，尝试修复数组格式问题
        console.warn("Second JSON parse attempt failed, trying array formatting fix:", secondError);
        
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
          console.error("Failed to parse JSON after all fixes:", thirdError);
          console.error("JSON string length:", jsonString.length);
          console.error("JSON string preview:", jsonString.substring(0, 1000));
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
    console.error("Error generating story outline:", error);
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

