import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { wanXImageClient } from "@/lib/dashscope/wanx-image";
import { tosClient } from "@/lib/volcano/storage";

// 火山引擎API配置
const VOLCANO_API_KEY = process.env.VOLCANO_API_KEY || process.env.ARK_API_KEY;
const VOLCANO_API_URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations";

// Using the exported instance instead of creating a new one

/**
 * POST /api/music/generate-character-image
 * 生成角色图片（支持文生图和图生图）
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
    const { prompt, refImg, refImages, sceneRefImg, characterRefImg, size = "1024*1024", count = 1 } = body;

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "Prompt is required" },
        { status: 400 }
      );
    }

    try {
      // 如果有多个参考图（refImages数组），使用火山引擎图生图API
      // 如果只有一个参考图，使用阿里云文生图API
      let imageUrl: string;
      
      if (refImages && Array.isArray(refImages) && refImages.length > 0) {
        // 使用火山引擎图生图API（支持多参考图）
        // refImages[0] = 场景图（参考图1）
        // refImages[1] = 人物图（参考图2）
        
        if (!VOLCANO_API_KEY) {
          throw new Error("VOLCANO_API_KEY or ARK_API_KEY is not configured");
        }

        // 转换尺寸格式（将 * 替换为 x）
        const apiSize = size.replace(/\*/g, "x");
        const imageCount = Math.max(1, Math.min(4, parseInt(String(count)) || 1)); // 限制在1-4之间
        const imageUrls: string[] = [];
        const delayBetweenRequests = 500; // 每个请求之间延迟500ms

        // 循环生成多张图片
        for (let i = 0; i < imageCount; i++) {
          try {
            // 如果不是第一个请求，添加延迟
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
            }

            const requestBody: any = {
              model: "doubao-seedream-4-0-250828",
              prompt: prompt,
              image: refImages, // 参考图数组 [场景图, 人物图]
              size: apiSize,
              sequential_image_generation: "disabled",
              stream: false,
              response_format: "url",
              watermark: false,
            };

            console.log(`[GenerateCharacterImage] Volcano Engine API request ${i + 1}/${imageCount}:`, {
              model: requestBody.model,
              prompt: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
              imageCount: refImages.length,
              size: requestBody.size,
            });

            const response = await fetch(VOLCANO_API_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${VOLCANO_API_KEY}`,
              },
              body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[GenerateCharacterImage] Volcano Engine API error for image ${i + 1}: ${response.status}. ${errorText.substring(0, 200)}`);
              // 继续处理下一个请求，而不是立即失败
              continue;
            }

            const result = await response.json();
            console.log(`[GenerateCharacterImage] Volcano Engine API response ${i + 1}/${imageCount}:`, result);

            // 火山引擎返回格式：{ data: [{ url: "..." }] }
            if (result.data && result.data.length > 0 && result.data[0].url) {
              imageUrls.push(result.data[0].url);
            } else {
              console.error(`[GenerateCharacterImage] Volcano Engine API did not return image URL for image ${i + 1}`);
            }
          } catch (error) {
            console.error(`[GenerateCharacterImage] Error generating image ${i + 1}:`, error);
            // 继续处理下一个请求
            continue;
          }
        }

        if (imageUrls.length === 0) {
          throw new Error("Failed to generate any images");
        }

        // 如果只需要一张图片，返回第一张；否则返回所有图片
        imageUrl = imageUrls[0];
        
        // 上传所有图片到云存储
        const uploadedUrls: string[] = [];
        for (let i = 0; i < imageUrls.length; i++) {
          const filename = `music-characters/${user.id}/${Date.now()}-${i}.png`;
          const uploadedUrl = await tosClient.uploadImageFromUrl(imageUrls[i], filename);
          uploadedUrls.push(uploadedUrl);
        }

        return NextResponse.json({
          success: true,
          data: {
            imageUrl: uploadedUrls[0], // 兼容单张图片的返回格式
            images: uploadedUrls, // 返回所有图片的数组
          },
        });
      } else {
        // 使用阿里云文生图API（单个参考图）
        const finalRefImg = characterRefImg || refImg || sceneRefImg;
        const task = await wanXImageClient.submitImageTask({
          prompt,
          size,
          n: 1,
          refImg: finalRefImg || undefined, // 如果有参考图片，使用文生图的ref参数
        });

        // 轮询等待图片生成完成
        const status = await wanXImageClient.pollImageTaskStatus(task.taskId);

        if (status.status === "SUCCEEDED" && status.images && status.images.length > 0) {
          imageUrl = status.images[0];
        } else {
          throw new Error(status.message || "Image generation failed");
        }
      }

      // 上传到云存储
      const filename = `music-characters/${user.id}/${Date.now()}.png`;
      const uploadedUrl = await tosClient.uploadImageFromUrl(imageUrl, filename);

      return NextResponse.json({
        success: true,
        data: {
          imageUrl: uploadedUrl,
          images: [uploadedUrl], // 返回数组格式以兼容前端
        },
      });
    } catch (error) {
      console.error("[GenerateCharacterImage] Error:", error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Failed to generate image",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[GenerateCharacterImage] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

