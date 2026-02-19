import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tosClient } from "@/lib/volcano/storage";

/**
 * POST /api/scenes/upload-image-from-url
 * 从URL上传图片到火山存储 storybooks bucket
 * 用于从生成的图片URL上传到永久存储
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: "imageUrl is required" },
        { status: 400 }
      );
    }

    // 生成唯一文件名
    const fileExt = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    try {
      // 从URL下载图片并上传到火山存储 storybooks bucket
      const url = await tosClient.uploadImageFromUrl(imageUrl, fileName);
      return NextResponse.json({
        success: true,
        data: {
          url: url,
          path: fileName,
        },
      });
    } catch (uploadError) {
      // 检查是否是网络错误或下载错误
      if (uploadError instanceof Error) {
        if (uploadError.message.includes('Failed to download')) {
          return NextResponse.json(
            {
              success: false,
              error: `Failed to download image from source: ${uploadError.message}`,
              details: 'The image URL may be invalid or expired. Please try regenerating the image.',
              imageUrl: imageUrl, // 返回原始URL用于调试
            },
            { status: 400 }
          );
        }
        if (uploadError.message.includes('TOS') || uploadError.message.includes('storage') || uploadError.message.includes('upload')) {
          return NextResponse.json(
            {
              success: false,
              error: `Storage upload failed: ${uploadError.message}`,
              details: 'Please check storage configuration and try again.',
              imageUrl: imageUrl, // 返回原始URL用于调试
            },
            { status: 500 }
          );
        }
      }
      throw uploadError; // 重新抛出未知错误
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to upload image from URL",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

