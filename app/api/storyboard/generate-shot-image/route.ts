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
    const { scene_item_id, project_id, shot_number, image_prompt, characters, appearCharacters, charactersList } = body;

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
      console.log("Using appearCharacters from shot:", characterNames);
    }
    
    // Priority 2: Use characters parameter if appearCharacters is not available
    if (characterNames.length === 0 && characters && characters.trim()) {
      characterNames = characters.split(',').map((name: string) => name.trim()).filter((name: string) => name.length > 0);
      console.log("Using characters parameter:", characterNames);
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
        console.log("Extracted characters from image_prompt:", characterNames);
      }
    }

    // 3. Check if image_prompt contains characters
    const hasCharactersInPrompt = characterNames.length > 0;

    // 4. Build character prompts from charactersList (passed from frontend) or query from database
    // Only append prompts for characters that exist and have image_generation_prompt
    const refImages: string[] = []; // Reference images array (max 2)
    const allCharactersInfo: string[] = []; // All character prompt info, format: Character [name]: image_generation_prompt

    if (hasCharactersInPrompt && characterNames.length > 0) {
      let charactersData: any[] = [];
      
      // Priority: Use charactersList from frontend if provided (avoid database query)
      if (charactersList && Array.isArray(charactersList) && charactersList.length > 0) {
        console.log("Using charactersList from frontend (cached), count:", charactersList.length);
        // Filter charactersList to only include requested character names
        charactersData = charactersList.filter((char: any) => {
          const charName = char.name?.trim();
          if (!charName) return false;
          return characterNames.some((reqName: string) => 
            reqName.trim().toLowerCase() === charName.toLowerCase()
          );
        });
        console.log("Filtered characters from frontend list:", charactersData.length);
      } else {
        // Fallback: Query from database if charactersList not provided
        console.log("charactersList not provided, querying from database...");
        const { data: dbCharacters, error: charactersError } = await supabase
          .from('anim_characters')
          .select('name, image_url, image_generation_prompt')
          .eq('project_id', project_id)
          .eq('user_id', user.id)
          .in('name', characterNames);
        
        if (charactersError) {
          console.error("Error fetching characters from anim_characters:", charactersError);
        } else if (dbCharacters) {
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
            // Collect reference images (max 2, prioritize characters with images)
            if (char.image_url && refImages.length < 2) {
              refImages.push(char.image_url);
            }
            
            // Only append prompt if image_generation_prompt exists
            if (char.image_generation_prompt && typeof char.image_generation_prompt === 'string' && char.image_generation_prompt.trim()) {
              const charInfo = `Character [${char.name.trim()}]: ${char.image_generation_prompt.trim()}`;
              allCharactersInfo.push(charInfo);
              console.log(`✓ Character "${char.name}" found, prompt appended`);
            } else {
              console.log(`⚠ Character "${char.name}" found but no image_generation_prompt, skipping`);
            }
          } else {
            // Character not found, skip
            console.log(`✗ Character "${charName}" not found, skipping`);
          }
        });
      } else {
        console.log("No characters found for the given names");
      }
      
      console.log("=== Character Matching Results ===");
      console.log("Requested characters:", characterNames);
      console.log("Characters found:", charactersData.length);
      console.log("Characters with prompts appended:", allCharactersInfo.length);
      console.log("Reference images count:", refImages.length);
      allCharactersInfo.forEach((info, index) => {
        console.log(`Character ${index + 1} prompt:`, info);
      });
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
            console.error("Error generating presigned URL:", error);
            // If failed, continue using original URL
            finalRefImages.push(refImage);
          }
        } else {
          finalRefImages.push(refImage);
        }
      }
    }

    // 7. Choose API based on whether reference images exist, use calculated image size
    let taskId: string;
    let requestId: string;
    
    if (finalRefImages.length > 0) {
      // Has reference images, use image-to-image API
      const result = await wanXImageClient.submitImageToImageTask({
        prompt: enhancedPrompt,
        images: finalRefImages, // Reference images array (max 2)
        n: 4, // Generate 4 images for selection
        size: imageSize, // Use calculated size based on aspect ratio
      });
      taskId = result.taskId;
      requestId = result.requestId;

      // Log final submitted parameters
      console.log("=== Final Submitted Parameters (Image-to-Image) ===");
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
      // No reference images, use text-to-image API
      const result = await wanXImageClient.submitImageTask({
        prompt: enhancedPrompt,
        n: 4, // Generate 4 images for selection
        size: imageSize, // Use calculated size based on aspect ratio
      });
      taskId = result.taskId;
      requestId = result.requestId;

      // Log final submitted parameters
      console.log("=== Final Submitted Parameters (Text-to-Image) ===");
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

