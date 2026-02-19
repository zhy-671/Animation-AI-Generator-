import { NextRequest, NextResponse } from "next/server";
import { wanXImageClient } from "@/lib/dashscope/wanx-image";
import { tosClient } from "@/lib/volcano/storage";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/scenes/image-status
 * 查询图像生成任务状态
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId is required" },
        { status: 400 }
      );
    }

    // 查询任务状态
    const status = await wanXImageClient.getImageTaskStatus(taskId);

    // 如果任务成功完成，上传所有图片到火山存储
    let uploadedImageUrls: string[] = [];
    if (status.status === "SUCCEEDED" && status.images && status.images.length > 0) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || 'anonymous';
        
        // 上传所有图片（最多4张）
        const uploadPromises = status.images.slice(0, 4).map(async (imageUrl: string, index: number) => {
          try {
            const filename = `${userId}/scene-${Date.now()}-${taskId}-${index}.png`;
            return await tosClient.uploadImageFromUrl(imageUrl, filename);
          } catch (uploadError) {
            // 如果上传失败，返回原始URL
            return imageUrl;
          }
        });
        
        uploadedImageUrls = await Promise.all(uploadPromises);
      } catch (uploadError) {
        // 如果批量上传失败，返回原始URLs
        uploadedImageUrls = status.images.slice(0, 4);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId: status.taskId,
        status: status.status,
        imageUrl: uploadedImageUrls.length > 0 ? uploadedImageUrls[0] : (status.images && status.images[0]) || null, // 向后兼容：保留单张图片字段
        imageUrls: uploadedImageUrls.length > 0 ? uploadedImageUrls : (status.images || []).slice(0, 4), // 新增：返回所有图片数组
        message: status.message,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get image status",
      },
      { status: 500 }
    );
  }
}

