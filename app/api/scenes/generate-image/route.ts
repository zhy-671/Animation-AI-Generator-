import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { wanXImageClient } from "@/lib/dashscope/wanx-image";

/**
 * POST /api/scenes/generate-image
 * 提交图片生成任务（异步，生成4张图片供选择）
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
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { success: false, error: "Prompt is required" },
        { status: 400 }
      );
    }

    // 调用 WanX API 提交图片生成任务（生成4张图片）
    const { taskId, requestId } = await wanXImageClient.submitImageTask({
      prompt: prompt.trim(),
      n: 4, // 生成4张图片
      size: "1024*1024",
    });

    return NextResponse.json({
      success: true,
      data: {
        taskId,
        requestId,
      },
    });
  } catch (error) {
    console.error("Error generating image:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate image",
      },
      { status: 500 }
    );
  }
}

