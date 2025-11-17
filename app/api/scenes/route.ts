import { NextRequest, NextResponse } from "next/server";
import {
  createScene,
  getUserScenes,
  getSceneWithItems,
  getSceneByProjectId,
  updateSceneItemImage,
  deleteSceneItemImage,
  updateSceneItemText,
  createOrUpdateVideo,
  deleteVideo,
  deleteScene,
} from "@/lib/supabase/scenes";

/**
 * POST /api/scenes
 * 创建分镜
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, summary, coverImageUrl, scenes, fullJsonData } = body;

    if (!title || !summary || !scenes || !Array.isArray(scenes)) {
      return NextResponse.json(
        { error: "title, summary, and scenes array are required" },
        { status: 400 }
      );
    }

    const scene = await createScene({
      title,
      summary,
      coverImageUrl,
      scenes: scenes.map((s: any) => ({
        sceneNumber: s.sceneNumber,
        text: s.text,
        sceneDetail: s.sceneDetail, // 传递画面描述
        imageUrl: s.imageUrl,
      })),
      fullJsonData, // 传递完整的 JSON 数据
    });

    return NextResponse.json({
      success: true,
      data: scene,
    });
  } catch (error) {
    console.error("Error creating scene:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create scene",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scenes
 * 获取用户的所有分镜
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sceneId = searchParams.get("sceneId");
    const projectId = searchParams.get("projectId");

    if (sceneId) {
      // 获取单个分镜详情（通过 sceneId）
      const scene = await getSceneWithItems(sceneId);
      if (!scene) {
        return NextResponse.json(
          { error: "Scene not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        data: scene,
      });
    } else if (projectId) {
      // 通过 projectId 查找分镜（通过 metadata.project_id）
      const scene = await getSceneByProjectId(projectId);
      if (!scene) {
        return NextResponse.json(
          { error: "Scene not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        data: scene,
      });
    } else {
      // 获取所有分镜列表
      const scenes = await getUserScenes();
      return NextResponse.json({
        success: true,
        data: scenes,
      });
    }
  } catch (error) {
    console.error("Error getting scenes:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get scenes",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/scenes?sceneId=xxx
 * 删除分镜
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sceneId = searchParams.get("sceneId");

    if (!sceneId) {
      return NextResponse.json(
        { error: "sceneId is required" },
        { status: 400 }
      );
    }

    await deleteScene(sceneId);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error deleting scene:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete scene",
      },
      { status: 500 }
    );
  }
}

