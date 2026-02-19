import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { wanXImageClient } from "@/lib/dashscope/wanx-image";

/**
 * GET /api/scenes/character-image-status
 * 查询角色图片生成任务状态
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: "taskId is required" },
        { status: 400 }
      );
    }

    // 查询任务状态
    const status = await wanXImageClient.getImageTaskStatus(taskId);

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to query image status",
      },
      { status: 500 }
    );
  }
}

