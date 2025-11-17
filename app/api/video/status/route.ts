import { NextRequest, NextResponse } from "next/server";
import { dashScopeClient } from "@/lib/dashscope/client";

/**
 * GET /api/video/status?taskId=xxx
 * 查询视频生成状态
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

    console.log("Querying video status for taskId:", taskId);

    try {
      const status = await dashScopeClient.getVideoStatus(taskId);

      return NextResponse.json({
        success: true,
        data: status,
      });
    } catch (dashScopeError) {
      console.error("DashScope API error:", dashScopeError);
      const errorMessage = dashScopeError instanceof Error 
        ? dashScopeError.message 
        : "Failed to get video status from DashScope";
      
      return NextResponse.json(
        {
          error: errorMessage,
          message: errorMessage, // 添加 message 字段以兼容前端
          details: dashScopeError instanceof Error ? dashScopeError.stack : String(dashScopeError),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in video status route:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to get video status";
    return NextResponse.json(
      {
        error: errorMessage,
        message: errorMessage, // 添加 message 字段以兼容前端
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

