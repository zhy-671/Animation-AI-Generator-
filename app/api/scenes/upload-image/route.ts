import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tosClient } from "@/lib/volcano/storage";

/**
 * POST /api/scenes/upload-image
 * 上传图片到火山存储 storybooks bucket
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // 生成唯一文件名
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();

    // 上传到火山存储 storybooks bucket
    const url = await tosClient.uploadImage(arrayBuffer, fileName);

    return NextResponse.json({
      success: true,
      data: {
        url: url,
        path: fileName,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to upload image",
      },
      { status: 500 }
    );
  }
}

