import { NextRequest, NextResponse } from "next/server";

const LAOZHANG_API_KEY = "sk-w4i8II1nU3YzJmfH5aB62d4c9bE44f378807Ff0880A87c3d";
const LAOZHANG_API_BASE = "https://api.laozhang.ai/v1";

/**
 * GET /api/video/status-laozhang?taskId=xxx
 * 查询 laozhang.ai 视频生成状态
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

    const statusResponse = await fetch(`${LAOZHANG_API_BASE}/videos/${taskId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${LAOZHANG_API_KEY}`,
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text().catch(() => "Unknown error");
      throw new Error(`Laozhang API error: ${statusResponse.status} ${errorText}`);
    }

    const result = await statusResponse.json();

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        status: result.status,
        progress: result.progress || 0,
        url: result.url,
        createdAt: result.created_at,
        completedAt: result.completed_at,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get video status",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

