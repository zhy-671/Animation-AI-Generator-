/**
 * 阿里云 DashScope 通义千问（Qwen2）客户端封装
 * 用于调用 Qwen2 模型进行分镜生成
 */

interface StoryboardGenerationRequest {
  prompt: string;
  style?: string; // 动画风格
  storyOutline?: any; // 故事大纲（包含story和characters）
  characters?: any[]; // 角色列表
}

interface StoryboardCharacter {
  role_type: 'main' | 'supporting' | 'pet';
  name: string;
  species: string;
  gender?: string;
  age?: string;
  size?: 'small' | 'medium' | 'large';
  color_palette: string;
  key_features: string;
  clothing_or_accessory?: string;
  pose_style?: string;
  behavior_traits?: string;
  consistency_token?: string;
}

interface StoryboardShot {
  shot_id: string;
  duration_seconds: number;
  description: string;
  characters: Array<{
    id: string;
    pose: string;
    expression: string;
    position: string;
    interaction?: string;
    visual_reference_prompt: string;
    art_style: string;
    dialogue: string;
  }>;
  background: string;
  camera: string;
  cinematic_notes: string;
}

interface StoryboardScene {
  scene_id: string;
  scene_title: string;
  scene_summary: string;
  shots: StoryboardShot[];
  // 兼容旧格式
  description?: string;
  camera?: string;
  dialogue?: string[];
  image_prompt?: string;
  duration?: string;
}

interface StoryboardGenerationResponse {
  title: string;
  summary: string;
  style: string;
  characters?: {
    main?: StoryboardCharacter | StoryboardCharacter[];
    supporting?: StoryboardCharacter[];
    pets?: StoryboardCharacter[];
  };
  scenes: StoryboardScene[];
}

class Qwen2Client {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.DASHSCOPE_API_KEY || "";
    this.baseUrl = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation";
    this.model = process.env.QWEN_MODEL || "qwen-plus"; // 默认使用 qwen-plus，也可以使用 qwen-max、qwen-turbo
    
    if (!this.apiKey) {
      console.warn("DASHSCOPE_API_KEY is not set");
    }
  }

  /**
   * 调用 Qwen2 模型生成动漫分镜
   */
  async generateStoryboard(request: StoryboardGenerationRequest): Promise<StoryboardGenerationResponse> {
    // 构建故事大纲和角色列表字符串
    let storyOutlineStr = "";
    let charactersStr = "";
    
    if (request.storyOutline) {
      storyOutlineStr = JSON.stringify(request.storyOutline.story || request.storyOutline, null, 2);
      if (request.storyOutline.characters) {
        charactersStr = JSON.stringify(request.storyOutline.characters, null, 2);
      }
    }
    
    if (request.characters && request.characters.length > 0) {
      charactersStr = JSON.stringify(request.characters, null, 2);
    }

    const systemPrompt = `You are a professional anime storyboard director and cinematic visual designer. 

Based on the following story outline and detailed character list, generate a **scene-based storyboard**, suitable for animation or cinematic sequences.

Requirements:

1. Divide the story into **scenes** (场次). Each scene may contain multiple **shots** (镜头), each lasting 5 or 10 seconds.

2. Each scene must include:
   - scene_id (unique identifier)
   - scene_title
   - scene_summary
   - shots: an array of shots

3. Each shot must include:
   - shot_id (unique identifier)
   - duration_seconds (5 or 10)
   - description: cinematic narration including mood, atmosphere, and action
   - characters present, for each:
       - id (from character list)
       - pose: full body action, gestures, body orientation
       - expression: subtle facial emotion
       - position: foreground, midground, background
       - interaction with props or environment if applicable
       - visual_reference_prompt: from character list
       - art_style: from character list
       - dialogue: character's spoken lines in this shot (can be empty if no line)
   - background: environment, time of day, weather, lighting, atmosphere
   - camera: angle, movement, zoom, focus
   - cinematic_notes: lighting effects, particles, wind, depth of field, or other cinematic cues

4. Ensure **all characters maintain consistent appearance and art_style** across all shots and scenes.

5. Include scene transitions or cuts if relevant.

6. Output strictly as a JSON array of scenes.

**JSON Format Requirements (CRITICAL)**:
- Must use standard ASCII double quotes ("), never use Chinese quotation marks ("、"、"、'、')
- All strings in dialogue must use standard ASCII double quotes
- All quotes within string values must be escaped as \\"
- Must not contain unescaped newlines, tabs, or other control characters
- Output must be valid JSON that can be directly parsed by JSON.parse()
- Do not include any markdown code blocks or extra text outside the JSON array`;

    // 构建用户提示词
    let userPrompt = "";
    
    if (storyOutlineStr && charactersStr) {
      // 如果有故事大纲和角色列表，使用新格式
      userPrompt = `Story Outline:
${storyOutlineStr}

Character List:
${charactersStr}

Output JSON Example:

[
  {
    "scene_id": "scene_01",
    "scene_title": "Academy Rooftop Encounter",
    "scene_summary": "The protagonist meets the supporting character on the rooftop at sunset, setting up the emotional tone.",
    "shots": [
      {
        "shot_id": "scene_01_shot_01",
        "duration_seconds": 5,
        "description": "Main character stands on the rooftop edge, cloak fluttering, gazing at the horizon with a determined expression.",
        "characters": [
          {
            "id": "char_001",
            "pose": "standing, right hand holding hat brim, cloak flowing in the wind, weight on left leg",
            "expression": "determined, subtle smile, eyes squinting against sunlight",
            "position": "foreground",
            "visual_reference_prompt": "{from character list}",
            "art_style": "{from character list}",
            "dialogue": "It's finally here..."
          }
        ],
        "background": "Academy rooftop at sunset, warm light, clouds drifting, gentle breeze, shadows elongated",
        "camera": "slightly low angle, slow pan from left to right, cinematic lighting, depth of field emphasizing main character",
        "cinematic_notes": "Wind subtly moves hair and cloak, golden hour glow, soft lens flare, cinematic depth"
      }
    ]
  }
]

Please generate the storyboard following this structure. Output only the JSON array, no additional text.`;
    } else {
      // 如果没有故事大纲，使用旧格式（向后兼容）
      const styleMap: Record<string, string> = {
        "2d": "2D动画风格，平面动画效果",
        "3d": "3D动画风格，立体三维效果",
        "anime": "日本二次元风格，日式动漫风格",
        "clay": "粘土动画风格，粘土材质效果",
        "comic": "美式漫画风格，美漫风格",
        "cartoon": "动漫风格，卡通动画效果",
        "cyberpunk": "赛博朋克风格，未来科技感",
      };
      
      const styleDescription = request.style ? styleMap[request.style] || "" : "";
      userPrompt = `User Input: ${request.prompt}${styleDescription ? `\n\n动画风格要求：${styleDescription}。请在画面描述和image_prompt中体现这种风格特点。` : ""}

请根据以上要求创作分镜，并严格按照 JSON 格式输出：
- 必须使用标准ASCII双引号（"），不能使用中文引号
- dialogue数组中的对白必须使用标准ASCII双引号
- 确保JSON格式完全正确，可以直接被解析
- 不要包含任何其他文字说明，只输出JSON。`;
    }

    try {
      const response = await fetch(`${this.baseUrl}/generation`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input: {
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
          },
          parameters: {
            temperature: 0.7,
            max_tokens: 4000,
            result_format: "message", // 返回消息格式
            incremental_output: false, // 非流式输出
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Qwen2 API request details:", {
          url: `${this.baseUrl}/generation`,
          model: this.model,
          status: response.status,
          error: errorText,
        });
        throw new Error(`Qwen2 API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // DashScope Qwen2 API 返回格式：
      // {
      //   "output": {
      //     "choices": [
      //       {
      //         "message": {
      //           "role": "assistant",
      //           "content": "..."
      //         }
      //       }
      //     ]
      //   },
      //   "request_id": "..."
      // }
      const content = data.output?.choices?.[0]?.message?.content || "";

      if (!content) {
        throw new Error("No content in Qwen2 response");
      }

      // 打印完整的原始响应内容用于调试
      console.log("=== Qwen2 Raw Response ===");
      console.log("Full response:", JSON.stringify(data, null, 2));
      console.log("Content length:", content.length);
      console.log("Content (full):", content);
      console.log("=== End Qwen2 Raw Response ===");

      // 提取 JSON 内容（可能包含代码块标记）
      let jsonContent = content.trim();
      
      // 移除可能的 markdown 代码块标记
      if (jsonContent.startsWith("```json")) {
        jsonContent = jsonContent.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (jsonContent.startsWith("```")) {
        jsonContent = jsonContent.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
      
      // 提取 JSON 内容 - 支持对象或数组格式
      let jsonString = "";
      
      // 检查是否是数组格式（新格式）
      const trimmedContent = jsonContent.trim();
      if (trimmedContent.startsWith('[')) {
        // 数组格式：找到第一个 [ 和最后一个 ]
        let bracketCount = 0;
        let startIndex = -1;
        let endIndex = -1;
        
        for (let i = 0; i < jsonContent.length; i++) {
          const char = jsonContent[i];
          if (char === '[') {
            if (startIndex === -1) startIndex = i;
            bracketCount++;
          } else if (char === ']') {
            bracketCount--;
            if (bracketCount === 0 && startIndex !== -1) {
              endIndex = i;
              break;
            }
          }
        }
        
        if (startIndex !== -1 && endIndex !== -1) {
          jsonString = jsonContent.substring(startIndex, endIndex + 1);
        }
      } else {
        // 对象格式（旧格式）：找到第一个 { 和最后一个 }
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
        }
      }
      
      if (!jsonString) {
        console.error("Could not find complete JSON in response");
        console.error("Content preview:", content.substring(0, 500));
        throw new Error("No complete JSON found in Qwen2 response");
      }
      
      // 打印提取的JSON字符串用于调试
      console.log("=== Extracted JSON String ===");
      console.log("JSON string length:", jsonString.length);
      console.log("JSON string (full):", jsonString);
      console.log("=== End Extracted JSON String ===");
      
      // 清理和修复JSON字符串中的控制字符和格式问题
      // 使用更可靠的方法：在字符串值中转义所有未转义的控制字符
      function cleanJsonString(str: string): string {
        // 首先替换中文引号为标准引号（在字符串值内）
        // 需要小心处理，只在字符串值内替换
        let result = '';
        let inString = false;
        let escapeNext = false;
        
        for (let i = 0; i < str.length; i++) {
          const char = str[i];
          const nextChar = i < str.length - 1 ? str[i + 1] : '';
          
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
              // 中文左引号（"）或右引号（"），替换为转义的标准引号
              result += '\\"';
            } else if (char === '\u2018' || char === '\u2019') {
              // 中文单引号（'或'），替换为转义的标准单引号
              result += "\\'";
            } else if (char === '\n') {
              result += '\\n';
            } else if (char === '\r') {
              result += '\\r';
            } else if (char === '\t') {
              result += '\\t';
            } else if (char.charCodeAt(0) < 32 && char !== '\n' && char !== '\r' && char !== '\t') {
              // 其他控制字符，使用Unicode转义
              result += `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
            } else {
              result += char;
            }
          } else {
            // 字符串外，移除换行和制表符
            if (char === '\n' || char === '\r') {
              if (nextChar === ' ' || nextChar === '\t') {
                continue;
              }
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

      // 先尝试直接解析
      let parsedData: any;
      try {
        parsedData = JSON.parse(jsonString);
      } catch (parseError) {
        // 如果解析失败，清理控制字符后重试
        console.warn("First JSON parse attempt failed, cleaning control characters:", parseError);
        
        try {
          const cleanedJson = cleanJsonString(jsonString);
          parsedData = JSON.parse(cleanedJson);
        } catch (secondError) {
          // 如果还是失败，尝试使用更宽松的修复方法
          console.warn("Second JSON parse attempt failed, trying aggressive fix:", secondError);
          
          // 尝试修复常见的JSON格式问题
          // 使用更简单直接的方法：先使用cleanJsonString清理，然后再进行额外的修复
          let fixedJson = cleanJsonString(jsonString);
          
          // 额外的修复：确保dialogue数组中的中文引号被正确处理
          // 匹配dialogue数组中的字符串值，替换其中的中文引号
          fixedJson = fixedJson.replace(/"dialogue":\s*\[([^\]]+)\]/g, (match: string, content: string) => {
            // 在dialogue数组内容中，替换中文引号为转义的标准引号
            const fixedContent = content
              .replace(/\u201C/g, '\\"')  // 中文左双引号
              .replace(/\u201D/g, '\\"')  // 中文右双引号
              .replace(/\u2018/g, "\\'")  // 中文左单引号
              .replace(/\u2019/g, "\\'"); // 中文右单引号
            return `"dialogue": [${fixedContent}]`;
          });
          
          // 使用更强大的状态机修复数组格式问题
          function fixArrayFormatting(json: string): string {
            let result = '';
            let inString = false;
            let escapeNext = false;
            let lastChar = '';
            let lastNonWhitespace = '';
            let braceDepth = 0;
            let bracketDepth = 0;
            let lastStringEndPos = -1; // 记录最后一个字符串结束的位置
            
            for (let i = 0; i < json.length; i++) {
              const char = json[i];
              const nextChar = i < json.length - 1 ? json[i + 1] : '';
              
              if (escapeNext) {
                result += char;
                escapeNext = false;
                lastChar = char;
                if (!/\s/.test(char)) lastNonWhitespace = char;
                continue;
              }
              
              if (char === '\\') {
                escapeNext = true;
                result += char;
                lastChar = char;
                continue;
              }
              
              if (char === '"') {
                if (!inString) {
                  // 字符串开始
                  // 检查前面是否需要添加逗号
                  if ((lastNonWhitespace === ']' || lastNonWhitespace === '}') && 
                      !result.trimEnd().endsWith(',') &&
                      !result.trimEnd().endsWith('[') &&
                      !result.trimEnd().endsWith('{')) {
                    result = result.trimEnd() + ', ';
                  }
                  // 检查是否在数组内，且前面是字符串结束（缺少逗号）
                  if (bracketDepth > 0 && lastStringEndPos >= 0) {
                    const trimmed = result.trimEnd();
                    if (trimmed.endsWith('"') && !trimmed.endsWith('",') && !trimmed.endsWith('["')) {
                      const beforeQuote = trimmed.slice(0, -1).trimEnd();
                      if (!beforeQuote.endsWith(',') && !beforeQuote.endsWith('[')) {
                        result = beforeQuote + ', "';
                        lastChar = '"';
                        lastNonWhitespace = '"';
                        inString = true;
                        continue;
                      }
                    }
                  }
                } else {
                  // 字符串结束
                  lastStringEndPos = result.length;
                }
                inString = !inString;
                result += char;
                lastChar = char;
                if (!/\s/.test(char)) lastNonWhitespace = char;
                continue;
              }
              
              if (!inString) {
                // 更新括号深度
                if (char === '{') braceDepth++;
                if (char === '}') braceDepth--;
                if (char === '[') bracketDepth++;
                if (char === ']') {
                  bracketDepth--;
                  lastStringEndPos = -1; // 重置字符串结束位置
                }
                
                // 修复数组格式问题
                if (char === '[' && lastNonWhitespace === ']') {
                  // ] 后直接跟 [（缺少逗号）
                  const trimmed = result.trimEnd();
                  if (!trimmed.endsWith(',') && !trimmed.endsWith('[')) {
                    result = trimmed + ', ';
                  }
                } else if (char === '{' && lastNonWhitespace === '}') {
                  // } 后直接跟 {（缺少逗号）
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
                // 在字符串内，保持原样
                result += char;
                if (!/\s/.test(char)) lastNonWhitespace = char;
              }
              
              lastChar = char;
            }
            
            return result;
          }
          
          fixedJson = fixArrayFormatting(fixedJson);
          
          // 额外的修复：使用正则表达式修复常见的数组格式问题
          // 注意：这些正则表达式可能会匹配字符串内的内容，但经过状态机处理后应该已经修复了大部分问题
          
          // 修复数组元素之间缺少逗号（最关键的修复）
          // 匹配："] 后直接跟 "（字符串之间缺少逗号，在数组内）
          fixedJson = fixedJson.replace(/("\s*)\]\s*"/g, '$1], "');
          
          // 修复其他数组格式问题
          fixedJson = fixedJson.replace(/"\s*\]\s*\[/g, '"], [');  // 数组之间
          fixedJson = fixedJson.replace(/"\s*\]\s*\{/g, '"], {');  // 数组后跟对象
          fixedJson = fixedJson.replace(/\}\s*\]\s*\[/g, '}], [');  // 对象后跟数组
          fixedJson = fixedJson.replace(/\}\s*\]\s*\{/g, '}], {');  // 对象后跟对象
          fixedJson = fixedJson.replace(/"\s*\}\s*\[/g, '"}, [');   // 字符串后跟数组
          fixedJson = fixedJson.replace(/"\s*\}\s*\{/g, '"}, {');    // 字符串后跟对象
          
          // 修复对象之间缺少逗号
          fixedJson = fixedJson.replace(/\}\s*\{/g, '}, {');
          
          // 修复数组之间缺少逗号
          fixedJson = fixedJson.replace(/\]\s*\[/g, '], [');
          
          // 最后一步：专门修复dialogue数组中的问题
          // 使用更精确的方法处理dialogue数组
          fixedJson = fixedJson.replace(/"dialogue":\s*\[([^\]]*)\]/g, (match: string, content: string) => {
            // 在dialogue数组内容中，修复字符串之间缺少逗号的问题
            // 匹配模式："] 后直接跟 "（字符串之间缺少逗号）
            let fixedContent = content;
            
            // 方法1：使用状态机在数组内容中查找并修复
            let result = '';
            let inString = false;
            let escapeNext = false;
            let lastChar = '';
            
            for (let i = 0; i < fixedContent.length; i++) {
              const char = fixedContent[i];
              
              if (escapeNext) {
                result += char;
                escapeNext = false;
                lastChar = char;
                continue;
              }
              
              if (char === '\\') {
                escapeNext = true;
                result += char;
                lastChar = char;
                continue;
              }
              
              if (char === '"') {
                if (!inString) {
                  // 字符串开始，检查前面是否需要逗号
                  if (lastChar === '"' && !result.trimEnd().endsWith(',')) {
                    const trimmed = result.trimEnd();
                    if (trimmed.endsWith('"') && !trimmed.endsWith('",') && !trimmed.endsWith('["')) {
                      result = trimmed.slice(0, -1).trimEnd() + '", "';
                      lastChar = '"';
                      inString = true;
                      continue;
                    }
                  }
                }
                inString = !inString;
                result += char;
                lastChar = char;
                continue;
              }
              
              result += char;
              if (!/\s/.test(char)) lastChar = char;
            }
            
            fixedContent = result;
            
            // 方法2：使用正则表达式作为补充修复
            // 匹配："] 后直接跟 "（缺少逗号）
            fixedContent = fixedContent.replace(/("\s*)\]\s*"/g, '$1], "');
            // 匹配：字符串结束后的引号（但只在数组元素之间，不在字符串内）
            // 使用更精确的匹配："] 后跟空格/换行，然后是 "
            fixedContent = fixedContent.replace(/("\s*)\s+(")/g, '$1, $2');
            
            return `"dialogue": [${fixedContent}]`;
          });
          
          try {
            parsedData = JSON.parse(fixedJson);
          } catch (thirdError) {
            // 如果还是失败，记录完整的错误信息
            console.error("JSON parse failed after all attempts. Error:", thirdError);
            console.error("Original content length:", content.length);
            console.error("Original content (first 2000 chars):", content.substring(0, 2000));
            console.error("JSON string length:", jsonString.length);
            console.error("JSON string (first 2000 chars):", jsonString.substring(0, 2000));
            console.error("Fixed JSON (first 2000 chars):", fixedJson.substring(0, 2000));
            
            // 尝试找到错误位置附近的上下文
            const errorMsg = thirdError instanceof Error ? thirdError.message : String(thirdError);
            const positionMatch = errorMsg.match(/position (\d+)/);
            if (positionMatch) {
              const pos = parseInt(positionMatch[1]);
              const start = Math.max(0, pos - 200);
              const end = Math.min(fixedJson.length, pos + 200);
              console.error(`=== JSON Parse Error at position ${pos} ===`);
              console.error(`Context (200 chars before and after):`);
              console.error(fixedJson.substring(start, end));
              console.error(`Character at position ${pos}:`, fixedJson[pos] || 'EOF');
              console.error(`Characters around position:`, {
                before: fixedJson.substring(Math.max(0, pos - 10), pos),
                at: fixedJson[pos],
                after: fixedJson.substring(pos + 1, Math.min(fixedJson.length, pos + 11))
              });
              
              // 尝试找到最近的dialogue数组
              const dialogueRegex = /"dialogue":\s*\[/g;
              let dialogueMatch;
              let lastDialoguePos = -1;
              while ((dialogueMatch = dialogueRegex.exec(fixedJson.substring(0, pos))) !== null) {
                lastDialoguePos = dialogueMatch.index;
              }
              if (lastDialoguePos >= 0) {
                const dialogueStart = lastDialoguePos;
                const dialogueEnd = Math.min(fixedJson.length, pos + 500);
                console.error(`=== Dialogue array context ===`);
                console.error(fixedJson.substring(dialogueStart, dialogueEnd));
              }
            }
            
            // 打印完整的修复后的JSON（用于调试）
            console.error("=== Full Fixed JSON ===");
            console.error(fixedJson);
            
            throw new Error(`Failed to parse JSON from Qwen2 response after multiple attempts: ${errorMsg}`);
          }
        }
      }

      // 转换数据格式：如果是新格式（数组），转换为旧格式
      let storyboardData: StoryboardGenerationResponse;
      
      if (Array.isArray(parsedData) && parsedData.length > 0) {
        // 新格式：数组格式，需要转换为旧格式
        // 提取第一个场景的标题和摘要作为整体标题和摘要
        const firstScene = parsedData[0];
        const title = firstScene?.scene_title || "Storyboard";
        const summary = parsedData
          .map((s: any) => s.scene_summary || s.scene_title)
          .filter(Boolean)
          .join("; ")
          .substring(0, 100);
        
        // 将场景和镜头展平为场景列表
        const scenes: StoryboardScene[] = [];
        parsedData.forEach((scene: any, sceneIndex: number) => {
          if (scene.shots && Array.isArray(scene.shots)) {
            // 新格式：有shots数组
            scene.shots.forEach((shot: any, shotIndex: number) => {
              // 收集所有角色的对话
              const dialogues: string[] = [];
              if (shot.characters && Array.isArray(shot.characters)) {
                shot.characters.forEach((char: any) => {
                  if (char.dialogue && char.dialogue.trim()) {
                    dialogues.push(char.dialogue);
                  }
                });
              }
              
              // 构建image_prompt（从shot的描述和角色信息）
              let imagePrompt = shot.description || "";
              if (shot.characters && Array.isArray(shot.characters)) {
                const charPrompts = shot.characters.map((char: any) => {
                  return `${char.visual_reference_prompt || ""}, ${char.pose || ""}, ${char.expression || ""}`;
                }).filter(Boolean);
                if (charPrompts.length > 0) {
                  imagePrompt += ", " + charPrompts.join(", ");
                }
              }
              if (shot.background) {
                imagePrompt += ", " + shot.background;
              }
              if (shot.cinematic_notes) {
                imagePrompt += ", " + shot.cinematic_notes;
              }
              
              scenes.push({
                scene_id: `${scene.scene_id}_shot_${shot.shot_id || shotIndex}`,
                scene_title: scene.scene_title || `Scene ${sceneIndex + 1}`,
                scene_summary: scene.scene_summary || "",
                shots: [shot],
                // 兼容旧格式字段
                description: shot.description || "",
                camera: shot.camera || "",
                dialogue: dialogues.length > 0 ? dialogues : [],
                image_prompt: imagePrompt,
                duration: String(shot.duration_seconds || 5),
              });
            });
          } else {
            // 旧格式：直接使用场景数据
            scenes.push({
              scene_id: scene.scene_id || String(sceneIndex + 1),
              scene_title: scene.scene_title || scene.title || `Scene ${sceneIndex + 1}`,
              scene_summary: scene.scene_summary || scene.summary || "",
              shots: [],
              description: scene.description || "",
              camera: scene.camera || "",
              dialogue: Array.isArray(scene.dialogue) ? scene.dialogue : [],
              image_prompt: scene.image_prompt || "",
              duration: scene.duration || "5",
            });
          }
        });
        
        storyboardData = {
          title,
          summary,
          style: request.style || "2d",
          scenes,
        };
      } else {
        // 旧格式：直接使用
        storyboardData = parsedData as StoryboardGenerationResponse;
      }

      // 验证数据格式
      if (!storyboardData.title || !storyboardData.summary || !storyboardData.scenes || !Array.isArray(storyboardData.scenes)) {
        throw new Error("Invalid storyboard data format");
      }

      // 验证每个场景的格式（兼容新旧格式）
      for (const scene of storyboardData.scenes) {
        if (!scene.scene_id || (!scene.description && !scene.shots)) {
          throw new Error("Invalid scene format");
        }
      }

      // 限制场景数量在 5-8 个
      if (storyboardData.scenes.length > 8) {
        storyboardData.scenes = storyboardData.scenes.slice(0, 8);
      } else if (storyboardData.scenes.length < 5) {
        // 如果少于5个，保持原样（可能是用户要求）
      }

      return storyboardData;
    } catch (error) {
      console.error("Error generating storyboard:", error);
      throw error;
    }
  }
}

export const qwen2Client = new Qwen2Client();
export type { StoryboardGenerationRequest, StoryboardGenerationResponse, StoryboardScene };

