import { NextRequest, NextResponse } from "next/server";
import { wanXImageClient } from "@/lib/dashscope/wanx-image";
import { tosClient } from "@/lib/volcano/storage";
import { createClient } from "@/lib/supabase/server";
import { createScene } from "@/lib/supabase/scenes";

/**
 * 将宽高比（如 "16:9"）转换为 API 需要的尺寸格式（如 "1920*1080"）
 */
function convertAspectRatioToSize(aspectRatio: string): string {
  // 如果已经是 width*height 格式，直接返回
  if (aspectRatio.includes('*')) {
    return aspectRatio;
  }

  // 解析宽高比
  const parts = aspectRatio.split(':');
  if (parts.length !== 2) {
    // 如果格式不正确，默认使用 16:9
    return "1920*1080";
  }

  const widthRatio = parseFloat(parts[0]);
  const heightRatio = parseFloat(parts[1]);

  if (isNaN(widthRatio) || isNaN(heightRatio) || widthRatio <= 0 || heightRatio <= 0) {
    // 如果解析失败，默认使用 16:9
    return "1920*1080";
  }

  // 根据宽高比计算合适的尺寸
  // 注意：API要求图片大小必须至少 921600 像素（约 960*960）
  // 使用常见的分辨率，保持宽高比，确保满足最小像素要求
  if (widthRatio / heightRatio === 16 / 9) {
    // 16:9 -> 1920*1080 (2,073,600 像素，满足要求)
    return "1920*1080";
  } else if (widthRatio / heightRatio === 4 / 3) {
    // 4:3 -> 1280*960 (1,228,800 像素，满足要求，之前 1024*768 太小)
    return "1280*960";
  } else if (widthRatio / heightRatio === 1) {
    // 1:1 -> 1024*1024 (1,048,576 像素，满足要求)
    return "1024*1024";
  } else if (widthRatio / heightRatio === 9 / 16) {
    // 9:16 (竖屏) -> 720*1280 (921,600 像素，刚好满足要求，之前 576*1024 太小)
    return "720*1280";
  } else if (widthRatio / heightRatio === 21 / 9) {
    // 21:9 (超宽屏) -> 2560*1080 (2,764,800 像素，满足要求)
    return "2560*1080";
  } else {
    // 其他比例，使用通用计算方式
    // 以高度为基准，计算宽度，确保至少 921600 像素
    const minPixels = 921600;
    let baseHeight = 1024;
    let calculatedWidth = Math.round((widthRatio / heightRatio) * baseHeight);
    let totalPixels = calculatedWidth * baseHeight;
    
    // 如果像素数不足，按比例放大
    if (totalPixels < minPixels) {
      const scale = Math.sqrt(minPixels / totalPixels);
      baseHeight = Math.round(baseHeight * scale);
      calculatedWidth = Math.round((widthRatio / heightRatio) * baseHeight);
      // 确保是偶数（某些API要求）
      baseHeight = baseHeight % 2 === 0 ? baseHeight : baseHeight + 1;
      calculatedWidth = calculatedWidth % 2 === 0 ? calculatedWidth : calculatedWidth + 1;
    } else {
      // 确保宽度是偶数（某些API要求）
      calculatedWidth = calculatedWidth % 2 === 0 ? calculatedWidth : calculatedWidth + 1;
    }
    
    return `${calculatedWidth}*${baseHeight}`;
  }
}

/**
 * POST /api/scenes/generate
 * 生成故事分镜
 * 使用通义千问（Qwen2）生成分镜，通义万相生成图像（依次提交和查询）
 * 流程：
 * 1. 生成分镜JSON后立即保存到数据库（图片URL为null）
 * 2. 图片生成成功后，更新数据库中的图片URL
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const prompt = formData.get("prompt") as string | null;
    const storyContentStr = formData.get("storyContent") as string | null;
    const projectIdStr = formData.get("projectId") as string | null;
    const referenceImage = formData.get("referenceImage") as File | null;
    const readerGroup = (formData.get("readerGroup") as string) || "全年龄";
    
    // 从项目设置获取风格和分辨率（优先使用项目设置）
    let style = (formData.get("style") as string) || "2d"; // 默认风格
    let artSetting = "16:9"; // 默认分辨率

    // 检查是否有已生成的故事内容，或者需要生成
    let storyboardData;
    
    if (storyContentStr) {
      // 使用已生成的故事内容
      try {
        storyboardData = JSON.parse(storyContentStr);
        // 更新风格（如果用户修改了）
        if (style && storyboardData.style !== style) {
          storyboardData.style = style;
        }
      } catch (error) {
        return NextResponse.json(
          { error: "Invalid story content format" },
          { status: 400 }
        );
      }
    } else if (prompt && prompt.trim()) {
      // 尝试从项目数据中获取故事大纲和角色列表
      let storyOutline: any = null;
      let characters: any[] | undefined = undefined;
      
      if (projectIdStr) {
        try {
          const supabase = await createClient();
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            // 查询项目数据（包括story_outline）
            const { data: projectData, error: projectError } = await supabase
              .from('anim_storyboard_projects')
              .select('story_outline')
              .eq('id', projectIdStr)
              .eq('user_id', user.id)
              .single();
            
            if (!projectError && projectData?.story_outline) {
              storyOutline = projectData.story_outline;
              if (storyOutline.characters) {
                characters = storyOutline.characters;
              }
            }
          }
        } catch (error) {
          // 继续使用prompt生成，不中断流程
        }
      }
      
      // 使用 Laozhang API 生成分镜
      const apiKey = process.env.LAOZHANG_API_KEY_STORY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "LAOZHANG_API_KEY_STORY is not configured" },
          { status: 500 }
        );
      }

      // 构建故事大纲和角色列表字符串
      let storyOutlineStr = "";
      let charactersStr = "";
      
      if (storyOutline) {
        storyOutlineStr = JSON.stringify(storyOutline.story || storyOutline, null, 2);
        if (storyOutline.characters) {
          charactersStr = JSON.stringify(storyOutline.characters, null, 2);
        }
      }
      
      if (characters && characters.length > 0) {
        charactersStr = JSON.stringify(characters, null, 2);
      }

      const systemPrompt = `You are a professional anime storyboard director and cinematic visual designer. 

Based on the following story outline and detailed character list, generate a **scene-based storyboard**, suitable for animation or cinematic sequences.

**LANGUAGE REQUIREMENT (CRITICAL)**: All output content MUST be in English only. No Chinese, Japanese, or any other non-English characters in the generated content. All field values (scene titles, descriptions, dialogue, etc.) must be in English.

Requirements:

1. Divide the story into **scenes**. Each scene may contain multiple **shots**, each lasting 5 or 10 seconds.

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
- Must use standard ASCII double quotes ("), never use Chinese quotation marks
- All strings in dialogue must use standard ASCII double quotes
- All quotes within string values must be escaped as \\"
- Must not contain unescaped newlines, tabs, or other control characters
- Output must be valid JSON that can be directly parsed by JSON.parse()
- Do not include any markdown code blocks or extra text outside the JSON array
- All content must be in English only - no Chinese characters anywhere in the output`;

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
          "2d": "2D animation style, flat animation effect",
          "3d": "3D animation style, three-dimensional effect",
          "anime": "Japanese anime style, Japanese animation style",
          "clay": "Clay animation style, clay material effect",
          "comic": "American comic style, Western comic style",
          "cartoon": "Cartoon animation style, animated cartoon effect",
          "cyberpunk": "Cyberpunk style, futuristic sci-fi aesthetic",
        };
        
        const styleDescription = style ? styleMap[style] || "" : "";
        userPrompt = `User Input: ${prompt}${styleDescription ? `\n\nAnimation Style Requirement: ${styleDescription}. Please reflect this style characteristic in the scene descriptions and image prompts.` : ""}

Please create the storyboard according to the requirements above and output strictly in JSON format:
- Must use standard ASCII double quotes ("), never use Chinese quotation marks
- All dialogue in the dialogue array must use standard ASCII double quotes
- Ensure the JSON format is completely correct and can be directly parsed
- Do not include any other text explanations, output only JSON.
- All content must be in English only - no Chinese characters anywhere in the output.`;
      }

      // 调用 Laozhang API
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
        const errorText = await response.text();
        return NextResponse.json(
          { error: `Laozhang API error: ${response.status} - ${errorText}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";

      if (!content) {
        return NextResponse.json(
          { error: "No content returned from Laozhang API" },
          { status: 500 }
        );
      }

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
        jsonString = jsonContent;
      }

      // 解析 JSON
      try {
        const parsed = JSON.parse(jsonString);
        
        // 如果是数组格式（新格式），直接使用
        if (Array.isArray(parsed)) {
          storyboardData = {
            title: "",
            summary: "",
            style: style || "2d",
            scenes: parsed,
          };
        } else {
          // 如果是对象格式（旧格式），转换为新格式
          storyboardData = parsed;
        }
      } catch (parseError) {
        return NextResponse.json(
          { error: `Failed to parse JSON from Laozhang API: ${parseError instanceof Error ? parseError.message : String(parseError)}` },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Either prompt or storyContent is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'anonymous';

    // 获取项目设置（风格和分辨率）以及主角图像URL
    let mainCharacterImageUrl: string | null = null;
    if (projectIdStr && user) {
      try {
        const { data: projectData, error: projectError } = await supabase
          .from('anim_storyboard_projects')
          .select('story_outline, character_design, art_setting, visual_style')
          .eq('id', projectIdStr)
          .eq('user_id', user.id)
          .single();
        
        if (!projectError && projectData) {
          // 获取项目设置（优先使用项目设置）
          if (projectData.art_setting) {
            artSetting = projectData.art_setting;
          }
          if (projectData.visual_style) {
            style = projectData.visual_style;
          }
          
          // 查找主角的图像URL
          if (projectData.story_outline?.characters && Array.isArray(projectData.story_outline.characters)) {
            const mainCharacter = projectData.story_outline.characters.find((char: any) => 
              char.role === 'Protagonist' || char.role === '主角' || char.role_type === 'main'
            ) || projectData.story_outline.characters[0];
            
            if (mainCharacter && projectData.character_design) {
              try {
                const characterDesign = typeof projectData.character_design === 'string'
                  ? JSON.parse(projectData.character_design)
                  : projectData.character_design;
                
                if (Array.isArray(characterDesign)) {
                  const charDesign = characterDesign.find((c: any) => 
                    c.id === mainCharacter.id || c.name === mainCharacter.name
                  );
                  if (charDesign?.imageUrl) {
                    mainCharacterImageUrl = charDesign.imageUrl;
                  }
                }
              } catch (e) {
              }
            }
          }
        }
      } catch (error) {
        // 继续执行，不中断流程
      }
    }

    // 步骤2: 立即保存分镜脚本到数据库（图片URL为null，后续会更新）
    if (!storyboardData.scenes || !Array.isArray(storyboardData.scenes)) {
      return NextResponse.json(
        { error: "Invalid storyboard data: scenes array is missing or invalid" },
        { status: 400 }
      );
    }

    const scene = await createScene({
      title: storyboardData.title,
      summary: storyboardData.summary,
      coverImageUrl: null, // 封面图稍后更新
      scenes: storyboardData.scenes.map((scene: any) => ({
        sceneNumber: scene.scene_id,
        text: scene.description,
        sceneDetail: scene.description,
        sceneTitle: scene.scene_title,
        camera: scene.camera,
        dialogue: scene.dialogue,
        sceneDuration: scene.duration,
        imageUrl: null, // 初始为null，图片生成成功后会更新
      })),
      fullJsonData: {
        title: storyboardData.title,
        summary: storyboardData.summary,
        style: storyboardData.style,
        scenes: storyboardData.scenes,
        originalPrompt: prompt,
        readerGroup: readerGroup,
      },
    });

    // 获取分镜项ID（用于后续更新图片URL）
    const { data: sceneItems } = await supabase
      .from('anim_scene_items')
      .select('id, scene_number')
      .eq('scene_id', scene.id)
      .order('scene_number', { ascending: true });

    // 检查是否使用SSE流式响应
    const useStreaming = request.headers.get('accept')?.includes('text/event-stream');
    
    if (useStreaming) {
      // 使用SSE流式响应
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const sendEvent = (event: string, data: any) => {
            const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));
          };
          
          try {
            // 先发送分镜数据
            sendEvent('scenes', {
              sceneId: scene.id,
              title: storyboardData.title,
              summary: storyboardData.summary,
              scenes: storyboardData.scenes.map((s: any, idx: number) => ({
                sceneNumber: s.scene_id || idx + 1,
                text: s.description || "",
                sceneDetail: s.description || "",
                sceneTitle: s.scene_title || "",
                camera: s.camera || "",
                dialogue: s.dialogue || [],
                duration: s.duration || "5",
                sceneItemId: sceneItems?.[idx]?.id,
              })),
            });
            
            // 依次提交图像生成任务，等待每个完成后再提交下一个
            for (let i = 0; i < storyboardData.scenes.length; i++) {
              const sceneItem = sceneItems?.[i];
              const scene = storyboardData.scenes[i];
              
              // 发送开始生成事件
              sendEvent('image-start', {
                index: i,
                sceneItemId: sceneItem?.id,
                sceneNumber: scene.scene_id || i + 1,
              });
              
              try {
                // 将 art_setting 转换为 API 需要的尺寸格式
                const imageSize = convertAspectRatioToSize(artSetting);
                
                const imageRequestPayload = {
                  prompt: scene.image_prompt,
                  style: style,
                  size: imageSize,
                  n: 1,
                  refImg: mainCharacterImageUrl || undefined,
                };

                console.log("[storyboard/generate] image request payload", {
                  sceneIndex: i,
                  sceneNumber: scene.scene_id || i + 1,
                  sceneItemId: sceneItem?.id,
                  payload: imageRequestPayload,
                });

                // 提交图像生成任务
                const task = await wanXImageClient.submitImageTask(imageRequestPayload);
                
                // 轮询等待图片生成完成
                let imageUrl: string | null = null;
                try {
                  const status = await wanXImageClient.pollImageTaskStatus(task.taskId);
                  
                  if (status.status === "SUCCEEDED" && status.images && status.images.length > 0) {
                    // 上传图片到TOS
                    try {
                      const filename = `${userId}/scene-${Date.now()}-${task.taskId}.png`;
                      imageUrl = await tosClient.uploadImageFromUrl(status.images[0], filename);
                      
                      // 更新数据库中的图片URL
                      if (sceneItem?.id) {
                        const { error: updateError } = await supabase
                          .from('anim_scene_items')
                          .update({ image_url: imageUrl })
                          .eq('id', sceneItem.id);
                        
                        if (updateError) {
                        }
                      }
                    } catch (uploadError) {
                      imageUrl = status.images[0];
                    }
                  }
                } catch (pollError) {
                }
                
                // 发送完成事件
                sendEvent('image-complete', {
                  index: i,
                  sceneItemId: sceneItem?.id,
                  sceneNumber: scene.scene_id || i + 1,
                  imageUrl: imageUrl,
                  success: !!imageUrl,
                });
              } catch (error) {
                // 发送失败事件
                sendEvent('image-complete', {
                  index: i,
                  sceneItemId: sceneItem?.id,
                  sceneNumber: scene.scene_id || i + 1,
                  imageUrl: null,
                  success: false,
                });
              }
            }
            
            // 发送完成事件
            sendEvent('done', {});
            controller.close();
          } catch (error) {
            sendEvent('error', {
              error: error instanceof Error ? error.message : "Unknown error",
            });
            controller.close();
          }
        },
      });
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
    
    // 非流式响应（保持向后兼容）
    const scenesWithTasks = [];
    
    for (let i = 0; i < storyboardData.scenes.length; i++) {
      const sceneItem = sceneItems?.[i];
      const scene = storyboardData.scenes[i];
      
      try {
        // 将 art_setting 转换为 API 需要的尺寸格式
        const imageSize = convertAspectRatioToSize(artSetting);
        
        const imageRequestPayload = {
          prompt: scene.image_prompt,
          style: style,
          size: imageSize,
          n: 1,
          refImg: mainCharacterImageUrl || undefined,
        };

        console.log("[storyboard/generate] image request payload", {
          sceneIndex: i,
          sceneNumber: scene.scene_id || i + 1,
          sceneItemId: sceneItem?.id,
          payload: imageRequestPayload,
        });
        // 提交图像生成任务
        const task = await wanXImageClient.submitImageTask(imageRequestPayload);
        
        // 轮询等待图片生成完成
        let imageUrl: string | null = null;
        try {
          const status = await wanXImageClient.pollImageTaskStatus(task.taskId);
          
          if (status.status === "SUCCEEDED" && status.images && status.images.length > 0) {
            try {
              const filename = `${userId}/scene-${Date.now()}-${task.taskId}.png`;
              imageUrl = await tosClient.uploadImageFromUrl(status.images[0], filename);
              
              if (sceneItem?.id) {
                const { error: updateError } = await supabase
                  .from('anim_scene_items')
                  .update({ image_url: imageUrl })
                  .eq('id', sceneItem.id);
                
                if (updateError) {
                }
              }
            } catch (uploadError) {
              imageUrl = status.images[0];
            }
          }
        } catch (pollError) {
        }
        
        scenesWithTasks.push({
          ...scene,
          imageTaskId: task.taskId,
          imageUrl: imageUrl,
          imageGenerationFailed: !imageUrl,
          sceneItemId: sceneItem?.id,
        });
      } catch (error) {
        scenesWithTasks.push({
          ...scene,
          imageTaskId: null,
          imageUrl: null,
          imageGenerationFailed: true,
          sceneItemId: sceneItem?.id,
        });
      }
    }

    // 步骤4: 组装结果（返回sceneId、sceneItemId和imageTaskId）
    if (!scenesWithTasks || !Array.isArray(scenesWithTasks)) {
      return NextResponse.json(
        { error: "Invalid scenes data: scenesWithTasks is missing or invalid" },
        { status: 500 }
      );
    }

    const result = {
      sceneId: scene.id, // 返回sceneId
      title: storyboardData.title,
      summary: storyboardData.summary,
      scenes: scenesWithTasks.map((scene, index) => {
        const originalScene = storyboardData.scenes[index] || {};
        return {
          text: scene.description || originalScene.description || "",
          sceneDetail: scene.description || originalScene.description || "",
          imageUrl: scene.imageUrl || null, // 初始为null，生成成功后更新
          imageTaskId: scene.imageTaskId || null, // 图片生成任务ID，用于前端轮询
          sceneNumber: originalScene.scene_id || scene.scene_id || index + 1,
          sceneTitle: originalScene.scene_title || scene.scene_title || "",
          camera: originalScene.camera || scene.camera || "",
          dialogue: originalScene.dialogue || scene.dialogue || [],
          duration: originalScene.duration || scene.duration || "5",
          imageGenerationFailed: scene.imageGenerationFailed || false,
          sceneItemId: scene.sceneItemId, // 返回sceneItemId用于前端更新
        };
      }),
      // 保存完整的 JSON 数据（新格式）
      fullJsonData: {
        title: storyboardData.title,
        summary: storyboardData.summary,
        style: storyboardData.style,
        scenes: scenesWithTasks.map((scene, index) => ({
          ...(storyboardData.scenes[index] || {}),
          imageTaskId: scene.imageTaskId,
        })),
        originalPrompt: prompt,
        readerGroup: readerGroup,
      },
    };

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate scenes",
      },
      { status: 500 }
    );
  }
}

