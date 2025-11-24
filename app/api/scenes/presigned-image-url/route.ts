import { NextRequest, NextResponse } from "next/server";
import { tosClient } from "@/lib/volcano/storage";

/**
 * GET /api/scenes/presigned-image-url
 * 获取图片的预签名 URL（用于显示图片，避免预签名 URL 过期）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const imageUrl = searchParams.get("imageUrl");

    if (!imageUrl) {
      return NextResponse.json(
        { error: "imageUrl is required" },
        { status: 400 }
      );
    }

    // 检查是否是 TOS URL
    const bucket = process.env.VOLC_TOS_BUCKET || "storybooks";
    const isTosUrl = imageUrl.includes(bucket) || imageUrl.includes('tos-') || imageUrl.includes('.volces.com');
    
    if (!isTosUrl) {
      // 如果不是 TOS URL，直接返回原始 URL
      return NextResponse.json({
        success: true,
        data: {
          imageUrl: imageUrl,
        },
      });
    }

    // 生成预签名 URL（有效期 7 天）
    const presignedUrl = await tosClient.getImagePresignedUrl(imageUrl, 7 * 24 * 3600);

    return NextResponse.json({
      success: true,
      data: {
        imageUrl: presignedUrl,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate presigned URL",
      },
      { status: 500 }
    );
  }
}

