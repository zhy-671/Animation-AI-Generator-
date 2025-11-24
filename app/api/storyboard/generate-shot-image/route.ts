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
    const { scene_item_id, project_id, shot_number, image_prompt, characters, appearCharacters, charactersList, watermark = false, editMode = false } = body;
    const normalizedShotNumber = typeof shot_number === "number"
      ? shot_number
      : shot_number !== undefined && shot_number !== null
        ? Number(shot_number)
        : null;

    if (!project_id || !image_prompt) {
      return NextResponse.json(
        { success: false, error: "project_id and image_prompt are required" },
        { status: 400 }
      );
    }

    // 1. 获取项目信息（包括比例字段 art_setting 和风格字段 visual_style）
    const { data: project, error: projectError } = await supabase
      .from('anim_storyboard_projects')
      .select('art_setting, visual_style')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (projectError) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch project: ${projectError.message}` },
        { status: 500 }
      );
    }

    // 获取项目设置（风格和分辨率）
    const projectArtSetting = project?.art_setting || "16:9";
    const projectVisualStyle = project?.visual_style || "2d";

    // 获取当前场景的场景图片（scene_image_url），每个分镜都必须使用
    let sceneReferenceImage: string | null = null;

    if (scene_item_id) {
      try {
        const { data: sceneItemData } = await supabase
          .from('anim_scene_items')
          .select('scene_image_url, image_url')
          .eq('id', scene_item_id)
          .maybeSingle();

        if (sceneItemData) {
          // 优先级1: 场景图（scene_image_url）
          if (sceneItemData.scene_image_url) {
            sceneReferenceImage = sceneItemData.scene_image_url;
          }
          // 优先级2: image_url（旧字段，保持兼容）
          else if (sceneItemData.image_url) {
            sceneReferenceImage = sceneItemData.image_url;
          }
        }
      } catch (error) {
        // Ignore scene item fetch errors, continue without scene reference image
      }
    }

    // 将 art_setting 的宽高比转换为 API 需要的 width*height 格式
    const imageSize = convertAspectRatioToSize(projectArtSetting);

    // 2. Extract character names from appearCharacters, characters parameter, or image_prompt
    // Priority: appearCharacters > characters parameter > extract from image_prompt
    let characterNames: string[] = [];
    
    // Priority 1: Use appearCharacters array if provided
    if (appearCharacters && Array.isArray(appearCharacters) && appearCharacters.length > 0) {
      characterNames = appearCharacters
        .map((name: any) => {
          if (typeof name === 'string') {
            return name.trim();
          } else if (name && typeof name === 'object') {
            return (name.name || name.姓名 || '').trim();
          }
          return '';
        })
        .filter((name: string) => name.length > 0);
    }
    
    // Priority 2: Use characters parameter if appearCharacters is not available
    if (characterNames.length === 0 && characters && characters.trim()) {
      characterNames = characters.split(',').map((name: string) => name.trim()).filter((name: string) => name.length > 0);
    }
    
    // Priority 3: If both are empty, try to extract character names from image_prompt
    if (characterNames.length === 0 && image_prompt) {
      // First, get all characters from anim_characters table for this project
      const { data: allCharacters, error: charsError } = await supabase
        .from('anim_characters')
        .select('name')
        .eq('project_id', project_id)
        .eq('user_id', user.id);
      
      if (!charsError && allCharacters && allCharacters.length > 0) {
        const allCharacterNames = allCharacters.map((c: any) => c.name).filter((name: string) => name) || [];
        
        // Check which character names appear in image_prompt
        const imagePromptLower = image_prompt.toLowerCase();
        allCharacterNames.forEach((charName: string) => {
          if (charName && charName.trim()) {
            const charNameLower = charName.toLowerCase().trim();
            // Check if character name appears in image_prompt (supports partial matching)
            if (imagePromptLower.includes(charNameLower)) {
              // Avoid duplicates
              if (!characterNames.some(name => name.toLowerCase() === charNameLower)) {
                characterNames.push(charName); // Use original case character name
              }
            }
          }
        });
      }
    }

    // 3. Check if image_prompt contains characters
    const hasCharactersInPrompt = characterNames.length > 0;

    // 4. Build character prompts from charactersList (passed from frontend) or query from database
    // Only append prompts for characters that exist and have image_generation_prompt
    const refImages: string[] = []; // Reference images array (max 2)
    const allCharactersInfo: string[] = []; // All character prompt info, format: Character [name]: image_generation_prompt
    let charactersData: any[] = []; // Character data for Volcano API

    if (hasCharactersInPrompt && characterNames.length > 0) {
      
      // Priority: Use charactersList from frontend if provided (avoid database query)
      if (charactersList && Array.isArray(charactersList) && charactersList.length > 0) {
        // Filter charactersList to only include requested character names
        // Use more flexible matching to handle variations
        charactersData = charactersList.filter((char: any) => {
          const charName = char.name?.trim();
          if (!charName) return false;
          const charNameLower = charName.toLowerCase();
          return characterNames.some((reqName: string) => {
            const reqNameLower = reqName.trim().toLowerCase();
            // Exact match or partial match
            return reqNameLower === charNameLower || 
                   reqNameLower.includes(charNameLower) || 
                   charNameLower.includes(reqNameLower);
          });
        });
      } else {
        // Fallback: Query from database if charactersList not provided
        const { data: dbCharacters, error: charactersError } = await supabase
          .from('anim_characters')
          .select('name, image_url, image_generation_prompt')
          .eq('project_id', project_id)
          .eq('user_id', user.id)
          .in('name', characterNames);
        
        if (!charactersError && dbCharacters) {
          charactersData = dbCharacters;
        }
      }
      
      if (charactersData.length > 0) {
        // Create a map of found characters for quick lookup
        const foundCharactersMap = new Map<string, any>();
        charactersData.forEach((char: any) => {
          const charName = char.name?.trim();
          if (charName) {
            foundCharactersMap.set(charName.toLowerCase(), char);
          }
        });
        
        // Process each character name from appearCharacters/characters parameter
        // Only append if character exists AND has image_generation_prompt
        characterNames.forEach((charName: string) => {
          const charNameLower = charName.trim().toLowerCase();
          const char = foundCharactersMap.get(charNameLower);
          
          if (char) {
            // Character found
            // Collect reference images (for Volcano API, collect all character images)
            // For DashScope API, limit to max 2
            if (char.image_url) {
              refImages.push(char.image_url);
            }
            
            // Only append prompt if image_generation_prompt exists
            if (char.image_generation_prompt && typeof char.image_generation_prompt === 'string' && char.image_generation_prompt.trim()) {
              const charInfo = `Character [${char.name.trim()}]: ${char.image_generation_prompt.trim()}`;
              allCharactersInfo.push(charInfo);
            }
          }
        });
      }
    }

    // 5. Build enhanced prompt
    // If there are character prompts, append them to the image prompt
    let enhancedPrompt = image_prompt;
    
    if (hasCharactersInPrompt && allCharactersInfo.length > 0) {
      // Append character information to the prompt, separated by semicolons
      const charactersInfo = allCharactersInfo.join('; ');
      enhancedPrompt = `${image_prompt}. ${charactersInfo}`;
    }

    // 6. Process reference images (presigned URLs if needed)
    const finalRefImages: string[] = [];
    
    if (refImages.length > 0) {
      // If reference image is TOS URL, may need to generate presigned URL
      for (const refImage of refImages) {
        if (refImage && (refImage.includes('tos-') || refImage.includes('.volces.com'))) {
          try {
            // Generate presigned URL to ensure API can access
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
            // If failed, continue using original URL
            finalRefImages.push(refImage);
          }
        } else {
          finalRefImages.push(refImage);
        }
      }
    }

    // 7. Always use Volcano API for image generation
    // Build character reference prompt: "角色名称参考 图1，角色名称参考 图2" etc.
    // 注意：提示词中的"图1"、"图2"对应的是图片数组中的第1个、第2个（索引从1开始）
    const characterRefPrompts: string[] = [];
    const volcanoRefImages: string[] = [];
    
    // Helper function to get presigned URL if needed
    const getPresignedUrl = async (imageUrl: string): Promise<string> => {
      if (!imageUrl) return imageUrl;
      
      // If reference image is TOS URL, may need to generate presigned URL
      if (imageUrl.includes('tos-') || imageUrl.includes('.volces.com')) {
        try {
          // Generate presigned URL to ensure API can access
          const presignedResponse = await fetch(
            `${request.nextUrl.origin}/api/scenes/presigned-image-url?imageUrl=${encodeURIComponent(imageUrl)}`
          );
          if (presignedResponse.ok) {
            const presignedResult = await presignedResponse.json();
            if (presignedResult.success && presignedResult.data?.imageUrl) {
              return presignedResult.data.imageUrl;
            }
          }
        } catch (error) {
          // If failed, continue using original URL
          console.warn(`Failed to get presigned URL for ${imageUrl}:`, error);
        }
      }
      return imageUrl;
    };
    
    // Only build character references if characters exist and have images
    if (hasCharactersInPrompt && characterNames.length > 0 && charactersData.length > 0) {
      // Create a map of found characters for quick lookup
      const foundCharactersMap = new Map<string, any>();
      charactersData.forEach((char: any) => {
        const charName = char.name?.trim();
        if (charName) {
          foundCharactersMap.set(charName.toLowerCase(), char);
        }
      });
      
      // Process each requested character name
      for (let i = 0; i < characterNames.length; i++) {
        const charName = characterNames[i];
        const charNameTrimmed = charName.trim();
        const charNameLower = charNameTrimmed.toLowerCase();
        const char = foundCharactersMap.get(charNameLower);
        
        if (char && char.image_url) {
          // Get presigned URL if needed
          const processedImageUrl = await getPresignedUrl(char.image_url);
          // 参考图索引从1开始（对应数组中的位置）
          const refNumber = volcanoRefImages.length + 1;
          characterRefPrompts.push(`${char.name.trim()}角色名称参考 图${refNumber}`);
          volcanoRefImages.push(processedImageUrl);
        } else {
          // Try to find by partial match or alternative lookup
          const alternativeChar = charactersData.find((c: any) => 
            c.name?.trim().toLowerCase() === charNameLower ||
            c.name?.trim().toLowerCase().includes(charNameLower) ||
            charNameLower.includes(c.name?.trim().toLowerCase())
          );
          if (alternativeChar && alternativeChar.image_url) {
            // Get presigned URL if needed
            const processedImageUrl = await getPresignedUrl(alternativeChar.image_url);
            // 参考图索引从1开始（对应数组中的位置）
            const refNumber = volcanoRefImages.length + 1;
            characterRefPrompts.push(`${alternativeChar.name.trim()}角色名称参考 图${refNumber}`);
            volcanoRefImages.push(processedImageUrl);
          }
        }
      }
    }
    
    // Append scene reference image for all shots (每个分镜都必须传当前场景的图片)
    // 场景参考图在所有角色参考图后面，编号为角色数量 + 1
    if (sceneReferenceImage) {
      // Get presigned URL if needed
      const processedSceneImageUrl = await getPresignedUrl(sceneReferenceImage);
      // 参考图索引从1开始（对应数组中的位置）
      const sceneReferenceIndex = volcanoRefImages.length + 1;
      const sceneReferenceLabel = `场景参考${sceneReferenceIndex}`;
      characterRefPrompts.push(sceneReferenceLabel);
      volcanoRefImages.push(processedSceneImageUrl);
    }

    // 添加风格提示词
    const stylePrompts: Record<string, string> = {
      "2d": "2D animation style, flat animation effect",
      "3d": "3D animation style, three-dimensional effect",
      "anime": "Japanese anime style, anime aesthetic",
      "clay": "clay animation style, clay material effect",
      "comic": "American comic style, comic book aesthetic",
      "cartoon": "cartoon animation style, cartoon effect",
      "cyberpunk": "cyberpunk style, futuristic sci-fi",
    };
    
    // 构建基础提示词（包含角色参考）
    let basePrompt = characterRefPrompts.length > 0
      ? `${image_prompt}，${characterRefPrompts.join('，')}`
      : image_prompt;
    
    // 添加风格提示词到最终提示词
    let volcanoPrompt = basePrompt;
    if (projectVisualStyle && stylePrompts[projectVisualStyle]) {
      const stylePrompt = stylePrompts[projectVisualStyle];
      // 如果提示词中不包含风格描述，则添加
      if (!volcanoPrompt.toLowerCase().includes(projectVisualStyle.toLowerCase())) {
        volcanoPrompt = `${volcanoPrompt}，${stylePrompt}`;
      }
    }
    
    // 构建API请求体
    const requestBody: any = {
      model: "doubao-seedream-4-0-250828",
      prompt: volcanoPrompt,
      sequential_image_generation: "auto",
      sequential_image_generation_options: {
        max_images: editMode === true ? 4 : 1, // Generate 4 images in edit mode, 1 image otherwise
      },
      response_format: "url",
      size: imageSize.includes("*") ? imageSize.replace(/\*/g, "x") : imageSize, // Convert "1920*1080" to "1920x1080"
      stream: false, // Set to false for storyboard generation
      watermark: watermark === true, // Use watermark parameter, default false
    };
    
    // 添加参考图数组（如果存在）
    if (volcanoRefImages.length > 0) {
      requestBody.image = volcanoRefImages;
    }
    
    console.log("[GenerateShotImage] Prompt payload", {
      project_id,
      shot_number,
      originalPrompt: image_prompt,
      enhancedPrompt,
      volcanoPrompt,
      characterNames,
      projectVisualStyle,
      projectArtSetting,
      editMode,
      watermark,
      referenceImagesCount: volcanoRefImages.length,
      referenceImages: volcanoRefImages.map((url, index) => ({
        index: index + 1, // 数组索引从0开始，但显示时从1开始
        url: url.substring(0, 100) + (url.length > 100 ? '...' : ''), // 只显示前100个字符
      })),
      characterRefPrompts,
    });
    
    console.log("[GenerateShotImage] Volcano API request body", {
      model: requestBody.model,
      prompt: requestBody.prompt,
      image: requestBody.image, // 完整的图片数组
      imageCount: requestBody.image?.length || 0,
      size: requestBody.size,
      watermark: requestBody.watermark,
    });
      
      // Call Volcano API
      const volcanoApiKey = process.env.VOLCANO_API_KEY || process.env.ARK_API_KEY;
      const volcanoBaseUrl = process.env.VOLCANO_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
      
      if (!volcanoApiKey) {
        throw new Error("VOLCANO_API_KEY or ARK_API_KEY is not configured");
      }
      
      const volcanoResponse = await fetch(`${volcanoBaseUrl}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${volcanoApiKey}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!volcanoResponse.ok) {
        const errorText = await volcanoResponse.text();
        throw new Error(`Volcano API error: ${volcanoResponse.status} - ${errorText}`);
      }
      
      const volcanoResult = await volcanoResponse.json();
      
      console.log("[GenerateShotImage] Volcano API response:", {
        hasData: !!volcanoResult.data,
        dataType: Array.isArray(volcanoResult.data) ? 'array' : typeof volcanoResult.data,
        dataLength: Array.isArray(volcanoResult.data) ? volcanoResult.data.length : 'N/A',
        hasUrl: !!volcanoResult.url,
        hasImageUrl: !!volcanoResult.image_url,
        resultKeys: Object.keys(volcanoResult),
      });
      
      // Extract image URLs from response
      // Note: The response format may vary, adjust based on actual API response
      // In edit mode, we expect multiple images (up to 4), otherwise just 1
      const imageDataArray = volcanoResult.data || [];
      const imageUrls: string[] = [];
      
      if (Array.isArray(imageDataArray) && imageDataArray.length > 0) {
        // Extract URLs from array of image objects
        imageUrls.push(...imageDataArray.map((item: any) => item.url || item.image_url).filter(Boolean));
        console.log("[GenerateShotImage] Extracted URLs from array:", imageUrls.length);
      } else if (volcanoResult.url || volcanoResult.image_url) {
        // Fallback: single image URL
        imageUrls.push(volcanoResult.url || volcanoResult.image_url);
        console.log("[GenerateShotImage] Extracted single URL from response");
      }
      
      if (imageUrls.length === 0) {
        console.error("[GenerateShotImage] No image URLs found in response:", JSON.stringify(volcanoResult, null, 2));
        throw new Error("No image URLs returned from Volcano API. Response: " + JSON.stringify(volcanoResult));
      }
      
      console.log("[GenerateShotImage] Successfully extracted image URLs:", imageUrls.length);
      
      // Upload all images to TOS
      console.log("[GenerateShotImage] Starting TOS upload for", imageUrls.length, "images");
      const uploadPromises = imageUrls.map((url, index) => {
        const filename = `storyboard-shots/${project_id}/${shot_number}-${Date.now()}-${index}.jpg`;
        console.log(`[GenerateShotImage] Uploading image ${index + 1}/${imageUrls.length} to TOS:`, filename);
        return tosClient.uploadImageFromUrl(url, filename).catch((error) => {
          console.error(`[GenerateShotImage] Failed to upload image ${index + 1} to TOS:`, error);
          throw new Error(`Failed to upload image ${index + 1} to TOS: ${error instanceof Error ? error.message : String(error)}`);
        });
      });
      
      // uploadImageFromUrl returns Promise<string>, not an object
      const uploadedUrls = await Promise.all(uploadPromises);
      console.log("[GenerateShotImage] Successfully uploaded", uploadedUrls.length, "images to TOS");
      
      // In edit mode, return all images. In normal mode, save first image to database
      if (!editMode) {
        // Save first image to database (non-edit mode)
        const { error: updateError } = await supabase
          .from('anim_scene_items')
          .update({
            image_url: uploadedUrls[0],
          })
          .eq('id', scene_item_id);
        
        if (updateError) {
          throw new Error(`Failed to save image: ${updateError.message}`);
        }
      }
      
      // 构建返回数据
      const responseData = {
        imageUrl: editMode ? null : uploadedUrls[0], // In edit mode, return null for imageUrl, use imageUrls instead
        imageUrls: editMode ? uploadedUrls : null, // In edit mode, return array of URLs
        taskId: null, // Volcano API doesn't use taskId when watermark is false
        requestId: volcanoResult.request_id || null,
        isVolcanoAPI: true, // Flag to indicate this is from Volcano API
        watermark: watermark,
      };
      
      return NextResponse.json({
        success: true,
        data: responseData,
      });
  } catch (error) {
    console.error("[GenerateShotImage] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate shot image";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[GenerateShotImage] Error details:", {
      message: errorMessage,
      stack: errorStack,
    });
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}

