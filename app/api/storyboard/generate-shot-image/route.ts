import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { wanXImageClient } from "@/lib/dashscope/wanx-image";
import { tosClient } from "@/lib/volcano/storage";

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
  // 使用常见的分辨率，保持宽高比
  if (widthRatio / heightRatio === 16 / 9) {
    // 16:9 -> 1920*1080
    return "1920*1080";
  } else if (widthRatio / heightRatio === 4 / 3) {
    // 4:3 -> 1024*768
    return "1024*768";
  } else if (widthRatio / heightRatio === 1) {
    // 1:1 -> 1024*1024
    return "1024*1024";
  } else if (widthRatio / heightRatio === 9 / 16) {
    // 9:16 (竖屏) -> 576*1024
    return "576*1024";
  } else if (widthRatio / heightRatio === 21 / 9) {
    // 21:9 (超宽屏) -> 2560*1080
    return "2560*1080";
  } else {
    // 其他比例，使用通用计算方式
    // 以高度为基准，计算宽度
    const baseHeight = 1024;
    const calculatedWidth = Math.round((widthRatio / heightRatio) * baseHeight);
    // 确保宽度是偶数（某些API要求）
    const finalWidth = calculatedWidth % 2 === 0 ? calculatedWidth : calculatedWidth + 1;
    return `${finalWidth}*${baseHeight}`;
  }
}

/**
 * POST /api/storyboard/generate-shot-image
 * 生成分镜图片，使用第一个角色的参考图，其他角色的外貌和衣着信息添加到提示词中
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { scene_item_id, project_id, shot_number, image_prompt, characters } = body;

    if (!project_id || !image_prompt) {
      return NextResponse.json(
        { success: false, error: "project_id and image_prompt are required" },
        { status: 400 }
      );
    }

    // 1. 获取项目信息（包括比例字段 art_setting）
    const { data: project, error: projectError } = await supabase
      .from('anim_storyboard_projects')
      .select('art_setting')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (projectError) {
      console.error("Error fetching project:", projectError);
      return NextResponse.json(
        { success: false, error: `Failed to fetch project: ${projectError.message}` },
        { status: 500 }
      );
    }

    // 将 art_setting 的宽高比转换为 API 需要的 width*height 格式
    const artSetting = project?.art_setting || "16:9";
    const imageSize = convertAspectRatioToSize(artSetting);

    // 2. 从 anim_story_outlines 获取角色列表
    // 注意：RLS策略会自动确保用户只能访问自己的项目数据，不需要手动添加user_id条件
    const { data: storyOutline, error: outlineError } = await supabase
      .from('anim_story_outlines')
      .select('characters')
      .eq('project_id', project_id)
      .maybeSingle(); // 使用 maybeSingle 而不是 single，避免找不到数据时报错

    if (outlineError) {
      console.error("Error fetching story outline:", outlineError);
      return NextResponse.json(
        { success: false, error: `Failed to fetch character data: ${outlineError.message}` },
        { status: 500 }
      );
    }

    if (!storyOutline) {
      console.error("Story outline not found for project_id:", project_id);
      return NextResponse.json(
        { success: false, error: "Story outline not found. Please complete project settings first." },
        { status: 404 }
      );
    }

    // 3. 从 image_prompt 中提取角色名称
    // 优先使用传入的 characters 参数，如果没有则从 image_prompt 中提取
    let characterNames: string[] = [];
    
    if (characters && characters.trim()) {
      // 如果传入了 characters 参数，使用它
      characterNames = characters.split(',').map((name: string) => name.trim()).filter((name: string) => name.length > 0);
    }
    
    // 如果 characters 为空，从 image_prompt 中提取角色名称
    if (characterNames.length === 0 && image_prompt && storyOutline.characters) {
      // 获取数据库中所有角色的名称
      const allCharacterNames = storyOutline.characters.map((c: any) => c.name).filter((name: string) => name) || [];
      
      // 在 image_prompt 中查找匹配的角色名称（更精确的匹配）
      const imagePromptLower = image_prompt.toLowerCase();
      allCharacterNames.forEach((charName: string) => {
        if (charName && charName.trim()) {
          const charNameLower = charName.toLowerCase().trim();
          // 检查角色名称是否在 image_prompt 中出现（支持部分匹配）
          if (imagePromptLower.includes(charNameLower)) {
            // 避免重复添加
            if (!characterNames.some(name => name.toLowerCase() === charNameLower)) {
              characterNames.push(charName); // 使用原始大小写的角色名
            }
          }
        }
      });
    }

    // 4. 检查 image_prompt 中是否真的包含角色
    const hasCharactersInPrompt = characterNames.length > 0;

    // 5. 如果图片提示词中包含角色，匹配角色并获取对应的参考图和角色信息
    // 确保每个角色对应的信息是准确的，不会混淆
    const refImages: string[] = []; // 参考图数组（最多2张）
    const allCharactersInfo: string[] = []; // 所有角色的提示词信息，格式：Character [角色名]: 信息

    if (hasCharactersInPrompt && storyOutline.characters && Array.isArray(storyOutline.characters)) {
      // 为每个在 image_prompt 中找到的角色，收集其对应的信息
      characterNames.forEach((charName) => {
        // 在数据库中查找匹配的角色（支持多种匹配方式）
        const char = storyOutline.characters.find((c: any) => {
          const dbName = (c.name || '').trim();
          const searchName = charName.trim();
          
          // 精确匹配
          if (dbName === searchName) return true;
          
          // 忽略大小写匹配
          if (dbName.toLowerCase() === searchName.toLowerCase()) return true;
          
          // 忽略空格匹配
          if (dbName.replace(/\s+/g, '') === searchName.replace(/\s+/g, '')) return true;
          
          // 包含匹配
          if (dbName.toLowerCase().includes(searchName.toLowerCase()) || 
              searchName.toLowerCase().includes(dbName.toLowerCase())) return true;
          
          return false;
        });

        if (char) {
          // 收集参考图（最多2张，优先使用有图片的角色）
          if (char.image_url && refImages.length < 2) {
            refImages.push(char.image_url);
          }
          
          // 构建该角色的信息字符串，明确标注角色名称
          let charInfo = '';
          
          // 优先使用保存的图片生成提示词
          if (char.image_generation_prompt && typeof char.image_generation_prompt === 'string' && char.image_generation_prompt.trim()) {
            charInfo = `Character [${charName}]: ${char.image_generation_prompt}`;
          } else {
            // 如果没有保存的提示词，从外貌和衣着信息构建
            const appearance = char.appearance || '';
            const clothing_style = char.clothing_style || '';
            
            // 构建角色信息，明确标注角色名称
            const infoParts: string[] = [];
            
            if (appearance) {
              if (typeof appearance === 'object') {
                infoParts.push(`Appearance: ${JSON.stringify(appearance)}`);
              } else {
                infoParts.push(`Appearance: ${appearance}`);
              }
            }
            
            if (clothing_style) {
              if (typeof clothing_style === 'object') {
                infoParts.push(`Clothing: ${JSON.stringify(clothing_style)}`);
              } else {
                infoParts.push(`Clothing: ${clothing_style}`);
              }
            }
            
            if (infoParts.length > 0) {
              charInfo = `Character [${charName}]: ${infoParts.join(', ')}`;
            } else {
              // 如果没有任何信息，至少标注角色名称
              charInfo = `Character [${charName}]`;
            }
          }
          
          if (charInfo) {
            allCharactersInfo.push(charInfo);
          }
        }
      });
      
      console.log("=== 角色匹配结果 ===");
      console.log("image_prompt:", image_prompt);
      console.log("找到的角色:", characterNames);
      console.log("匹配到的角色数量:", allCharactersInfo.length);
      console.log("参考图数量:", refImages.length);
      allCharactersInfo.forEach((info, index) => {
        console.log(`角色 ${index + 1} 信息:`, info);
      });
    }

    // 6. 构建增强的提示词
    // 如果有角色信息，将角色信息添加到提示词中，明确每个角色对应的信息
    let enhancedPrompt = image_prompt;
    
    if (hasCharactersInPrompt && allCharactersInfo.length > 0) {
      // 将角色信息添加到提示词中，每个角色的信息用分号分隔
      const charactersInfo = allCharactersInfo.join('; ');
      enhancedPrompt = `${image_prompt}. Character details: ${charactersInfo}`;
    }

    // 8. 如果有参考图，处理预签名URL；如果没有参考图，使用文生图API（不提交角色信息）
    const finalRefImages: string[] = [];
    
    if (refImages.length > 0) {
      // 如果参考图是TOS URL，可能需要生成预签名URL
      for (const refImage of refImages) {
        if (refImage && (refImage.includes('tos-') || refImage.includes('.volces.com'))) {
          try {
            // 生成预签名URL，确保API可以访问
            const presignedResponse = await fetch(
              `${request.nextUrl.origin}/api/scenes/presigned-image-url?imageUrl=${encodeURIComponent(refImage)}`
            );
            if (presignedResponse.ok) {
              const presignedResult = await presignedResponse.json();
              if (presignedResult.success && presignedResult.data?.imageUrl) {
                finalRefImages.push(presignedResult.data.imageUrl);
              } else {
                finalRefImages.push(refImage);
              }
            } else {
              finalRefImages.push(refImage);
            }
          } catch (error) {
            console.error("Error generating presigned URL:", error);
            // 如果失败，继续使用原始URL
            finalRefImages.push(refImage);
          }
        } else {
          finalRefImages.push(refImage);
        }
      }
    }

    // 9. 根据是否有参考图选择API，使用计算出的图片尺寸
    let taskId: string;
    let requestId: string;
    
    if (finalRefImages.length > 0) {
      // 有参考图，使用图生图API
      const result = await wanXImageClient.submitImageToImageTask({
        prompt: enhancedPrompt,
        images: finalRefImages, // 参考图数组（最多2张）
        n: 4, // 生成4张图片供选择
        size: imageSize, // 使用根据比例计算出的尺寸
      });
      taskId = result.taskId;
      requestId = result.requestId;

      // 只打印最终提交的参数
      console.log("=== 最终提交的参数（图生图） ===");
      console.log(JSON.stringify({
        model: "wan2.5-i2i-preview",
        prompt: enhancedPrompt,
        images: finalRefImages,
        n: 4,
        size: imageSize,
        taskId,
        requestId,
      }, null, 2));
    } else {
      // 没有参考图，使用文生图API
      const result = await wanXImageClient.submitImageTask({
        prompt: enhancedPrompt,
        n: 4, // 生成4张图片供选择
        size: imageSize, // 使用根据比例计算出的尺寸
      });
      taskId = result.taskId;
      requestId = result.requestId;

      // 只打印最终提交的参数
      console.log("=== 最终提交的参数（文生图） ===");
      console.log(JSON.stringify({
        model: "wan2.5-t2i-preview",
        prompt: enhancedPrompt,
        n: 4,
        size: imageSize,
        taskId,
        requestId,
      }, null, 2));
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId,
        requestId,
        hasReferenceImage: finalRefImages.length > 0,
        referenceImageCount: finalRefImages.length,
        charactersInfoCount: allCharactersInfo.length,
      },
    });
  } catch (error) {
    console.error("Error generating shot image:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate shot image",
      },
      { status: 500 }
    );
  }
}

