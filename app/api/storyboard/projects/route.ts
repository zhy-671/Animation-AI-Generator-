import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserWithRetry } from "@/lib/supabase/auth-helper";

/**
 * POST /api/storyboard/projects
 * 创建新的故事剧本项目
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError, isNetworkError } = await getUserWithRetry(supabase);

    if (authError) {
      if (isNetworkError) {
        return NextResponse.json(
          { 
            success: false,
            error: "Network connection timeout. Please check your internet connection and try again.",
            isNetworkError: true
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, content, story_outline } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // 构建插入数据
    const insertData: any = {
      user_id: user.id,
      title: title.trim(),
      content: content.trim(),
    };

    // 如果有故事大纲，存储为JSONB
    if (story_outline) {
      insertData.story_outline = typeof story_outline === 'string' 
        ? JSON.parse(story_outline) 
        : story_outline;
    }

    // 插入项目到数据库
    const { data: project, error: insertError } = await supabase
      .from("anim_storyboard_projects")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message || "Failed to create project" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: project.id,
        title: project.title,
        content: project.content,
        story_outline: project.story_outline,
        created_at: project.created_at,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create project",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/storyboard/projects
 * 获取用户的所有项目
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError, isNetworkError } = await getUserWithRetry(supabase);

    if (authError) {
      if (isNetworkError) {
        return NextResponse.json(
          { 
            success: false,
            error: "Network connection timeout. Please check your internet connection and try again.",
            isNetworkError: true
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: projects, error: fetchError } = await supabase
      .from("anim_storyboard_projects")
      .select("id, title, content, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message || "Failed to fetch projects" },
        { status: 500 }
      );
    }

    // 为每个项目获取第一个分镜的视频缩略图
    const projectsWithThumbnails = await Promise.all(
      (projects || []).map(async (project) => {
        let thumbnailUrl: string | null = null;
        
        try {
          // 先找到项目的第一个场景（通过 project_id）
          const { data: firstScene } = await supabase
            .from("anim_scenes")
            .select("id")
            .eq("project_id", project.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (firstScene) {
            // 找到第一个场景的第一个场次（scene_number = 1）
            const { data: firstSceneItem } = await supabase
              .from("anim_scene_items")
              .select("metadata, image_url")
              .eq("scene_id", firstScene.id)
              .order("scene_number", { ascending: true })
              .limit(1)
              .maybeSingle();

            if (firstSceneItem) {
              // 尝试从分镜数据中获取第一个shot的图片
              if (firstSceneItem.metadata?.storyboard?.shots && Array.isArray(firstSceneItem.metadata.storyboard.shots)) {
                // 找到第一个shot（shot_number = 1），如果没有则使用第一个
                const firstShot = firstSceneItem.metadata.storyboard.shots.find((shot: any) => shot.shot_number === 1) 
                  || firstSceneItem.metadata.storyboard.shots[0];
                
                if (firstShot) {
                  // 优先使用分镜图片（image_url），如果没有则使用视频URL（video_url）
                  thumbnailUrl = firstShot.image_url || firstShot.video_url || null;
                }
              }
              
              // 如果从分镜数据中没有获取到，使用场次的图片
              if (!thumbnailUrl) {
                thumbnailUrl = firstSceneItem.image_url || null;
              }
            }
          }
        } catch (error) {
          // 如果出错，thumbnailUrl 保持为 null
        }

        return {
          ...project,
          thumbnail_url: thumbnailUrl,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: projectsWithThumbnails || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch projects",
      },
      { status: 500 }
    );
  }
}

