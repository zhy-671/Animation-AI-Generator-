import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
 * POST /api/scenes/generate-image
 * 使用豆包文生图API生成图片（同步，生成4张图片供选择）
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
    const { prompt, sceneLocation, project_id } = body;

    // 打印接收到的参数
    console.log("[GenerateImage] Received parameters:", {
      prompt: prompt?.substring(0, 200) + (prompt?.length > 200 ? '...' : ''),
      promptLength: prompt?.length || 0,
      sceneLocation,
      project_id,
    });

    // 构建最终提示词
    // 前端已经构建了完整的 prompt（包含 Scene Location），这里只做兜底处理
    let finalPrompt = prompt;
    if (!finalPrompt || typeof finalPrompt !== "string" || !finalPrompt.trim()) {
      // 如果 prompt 为空，尝试使用 sceneLocation 构建（兜底逻辑）
      if (sceneLocation && typeof sceneLocation === "string" && sceneLocation.trim()) {
        finalPrompt = `Scene Location: ${sceneLocation.trim()}, scene, environment, location`;
      } else {
        return NextResponse.json(
          { success: false, error: "Prompt or sceneLocation is required" },
          { status: 400 }
        );
      }
    }

    // 获取项目设置（风格和分辨率）
    let projectArtSetting = "16:9"; // 默认值
    let projectVisualStyle = "2d"; // 默认值
    
    if (project_id) {
      try {
        const { data: project, error: projectError } = await supabase
          .from('anim_storyboard_projects')
          .select('art_setting, visual_style')
          .eq('id', project_id)
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (!projectError && project) {
          if (project.art_setting) projectArtSetting = project.art_setting;
          if (project.visual_style) projectVisualStyle = project.visual_style;
        }
      } catch (error) {
        // 如果获取项目设置失败，使用默认值
        console.error("Failed to fetch project settings:", error);
      }
    }

    // 使用火山引擎 API Key（支持 VOLCANO_API_KEY 或 ARK_API_KEY）
    const apiKey = process.env.VOLCANO_API_KEY || process.env.ARK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "VOLCANO_API_KEY or ARK_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // 将 art_setting 的宽高比转换为 API 需要的 width*height 格式
    const imageSize = convertAspectRatioToSize(projectArtSetting);
    // 转换为 API 需要的格式（将 * 替换为 x）
    const apiSize = imageSize.replace(/\*/g, "x");

    // 风格提示词映射
    const stylePrompts: Record<string, string> = {
      "2d": "2D animation style, flat animation effect",
      "3d": "3D animation style, three-dimensional effect",
      "anime": "Japanese anime style, anime aesthetic",
      "clay": "clay animation style, clay material effect",
      "comic": "American comic style, comic book aesthetic",
      "cartoon": "cartoon animation style, cartoon effect",
      "cyberpunk": "cyberpunk style, futuristic sci-fi",
    };
    
    // 添加风格提示词到最终提示词
    let styleEnhancedPrompt = finalPrompt;
    if (projectVisualStyle && stylePrompts[projectVisualStyle]) {
      const stylePrompt = stylePrompts[projectVisualStyle];
      // 如果提示词中不包含风格描述，则添加
      if (!styleEnhancedPrompt.toLowerCase().includes(projectVisualStyle.toLowerCase())) {
        styleEnhancedPrompt = `${styleEnhancedPrompt}, ${stylePrompt}`;
      }
    }

    // 打印项目设置和构建的参数
    console.log("[GenerateImage] Project settings and built parameters:", {
      project_id,
      projectArtSetting,
      projectVisualStyle,
      imageSize,
      apiSize,
      basePrompt: finalPrompt?.substring(0, 200) + (finalPrompt?.length > 200 ? '...' : ''),
      basePromptLength: finalPrompt?.length || 0,
      styleEnhancedPrompt: styleEnhancedPrompt?.substring(0, 200) + (styleEnhancedPrompt?.length > 200 ? '...' : ''),
      styleEnhancedPromptLength: styleEnhancedPrompt?.length || 0,
      stylePrompt: projectVisualStyle && stylePrompts[projectVisualStyle] ? stylePrompts[projectVisualStyle] : null,
    });

    // 豆包文生图API是同步的，需要生成4张图片，所以调用4次
    // 为了避免速率限制，添加小延迟
    const imageUrls: string[] = [];
    const delayBetweenRequests = 500; // 每个请求之间延迟500ms

    for (let i = 0; i < 4; i++) {
      try {
        // 如果不是第一个请求，添加延迟
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
        }

        const requestBody = {
          model: "doubao-seedream-4-0-250828",
          prompt: styleEnhancedPrompt.trim(),
          size: apiSize,
          sequential_image_generation: "disabled",
          stream: false,
          response_format: "url",
          watermark: false,
        };

        // 打印每次API调用的请求参数
        console.log(`[GenerateImage] API request ${i + 1}/4:`, {
          model: requestBody.model,
          prompt: requestBody.prompt.substring(0, 300) + (requestBody.prompt.length > 300 ? '...' : ''),
          promptLength: requestBody.prompt.length,
          size: requestBody.size,
          sequential_image_generation: requestBody.sequential_image_generation,
          stream: requestBody.stream,
          response_format: requestBody.response_format,
          watermark: requestBody.watermark,
          apiUrl: "https://ark.cn-beijing.volces.com/api/v3/images/generations",
        });

        const response = await fetch("https://ark.cn-beijing.volces.com/api/v3/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Doubao Image API error for image ${i + 1}: ${response.status}. ${errorText.substring(0, 200)}`);
          // 继续处理下一个请求，而不是立即失败
          continue;
        }

        const result = await response.json();
        
        // 打印API响应信息
        console.log(`[GenerateImage] API response ${i + 1}/4:`, {
          success: response.ok,
          status: response.status,
          hasData: !!result.data,
          dataLength: result.data?.length || 0,
          imageUrl: result.data?.[0]?.url ? result.data[0].url.substring(0, 100) + '...' : null,
        });
        
        if (result.data && Array.isArray(result.data) && result.data.length > 0) {
          const imageUrl = result.data[0].url;
          if (imageUrl) {
            imageUrls.push(imageUrl);
          }
        }
      } catch (error) {
        console.error(`Error generating image ${i + 1}:`, error);
        // 继续处理下一个请求
        continue;
      }
    }

    if (imageUrls.length === 0) {
      throw new Error("No images generated from Doubao API. All requests failed.");
    }

    // 打印最终结果摘要
    console.log("[GenerateImage] Final result summary:", {
      project_id,
      totalImagesGenerated: imageUrls.length,
      imageUrls: imageUrls.map((url, index) => ({
        index: index + 1,
        url: url.substring(0, 100) + '...',
      })),
    });

    // 返回图片URL数组（兼容原有格式，但不再需要taskId）
    return NextResponse.json({
      success: true,
      data: {
        images: imageUrls,
        // 为了兼容前端轮询逻辑，返回一个虚拟的taskId，但实际图片已经生成完成
        taskId: `doubao-sync-${Date.now()}`,
        immediate: true, // 标记为立即返回，不需要轮询
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate image",
      },
      { status: 500 }
    );
  }
}

