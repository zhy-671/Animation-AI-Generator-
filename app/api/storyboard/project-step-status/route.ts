import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserWithRetry } from "@/lib/supabase/auth-helper";

/**
 * GET /api/storyboard/project-step-status
 * 获取项目的步骤完成状态
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

    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "projectId is required" },
        { status: 400 }
      );
    }

    // 验证项目存在且属于当前用户
    const { data: project, error: projectError } = await supabase
      .from("anim_storyboard_projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    // 查询项目步骤状态
    const { data: status, error } = await supabase
      .from("anim_project_step_status")
      .select("step_script, step_settings, step_storyboard, step_video")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      return NextResponse.json(
        { success: false, error: `Failed to fetch status: ${error.message}` },
        { status: 500 }
      );
    }

    // 如果不存在，自动创建记录（所有步骤未完成）
    if (!status) {
      const { data: newStatus, error: createError } = await supabase
        .from("anim_project_step_status")
        .insert({
          project_id: projectId,
          user_id: user.id,
          step_script: false,
          step_settings: false,
          step_storyboard: false,
          step_video: false,
        })
        .select("step_script, step_settings, step_storyboard, step_video")
        .single();

      if (createError) {
        return NextResponse.json(
          { success: false, error: `Failed to create status: ${createError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          step_script: newStatus.step_script || false,
          step_settings: newStatus.step_settings || false,
          step_storyboard: newStatus.step_storyboard || false,
          step_video: newStatus.step_video || false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        step_script: status.step_script || false,
        step_settings: status.step_settings || false,
        step_storyboard: status.step_storyboard || false,
        step_video: status.step_video || false,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch project step status",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/storyboard/project-step-status
 * 更新项目的步骤完成状态
 */
export async function PATCH(request: NextRequest) {
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
    const { project_id, step_script, step_settings, step_storyboard, step_video } = body;

    if (!project_id) {
      return NextResponse.json(
        { success: false, error: "project_id is required" },
        { status: 400 }
      );
    }

    // 验证项目存在且属于当前用户
    const { data: project, error: projectError } = await supabase
      .from("anim_storyboard_projects")
      .select("id")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    // 构建更新数据（只更新传入的字段）
    const updateData: any = {};
    if (step_script !== undefined) updateData.step_script = step_script;
    if (step_settings !== undefined) updateData.step_settings = step_settings;
    if (step_storyboard !== undefined) updateData.step_storyboard = step_storyboard;
    if (step_video !== undefined) updateData.step_video = step_video;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one step status must be provided" },
        { status: 400 }
      );
    }

    // 使用 upsert 来更新或插入
    const { data: status, error: upsertError } = await supabase
      .from("anim_project_step_status")
      .upsert(
        {
          project_id: project_id,
          user_id: user.id,
          ...updateData,
        },
        {
          onConflict: "project_id,user_id",
        }
      )
      .select()
      .single();

    if (upsertError) {
      return NextResponse.json(
        { success: false, error: `Failed to update status: ${upsertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        step_script: status.step_script || false,
        step_settings: status.step_settings || false,
        step_storyboard: status.step_storyboard || false,
        step_video: status.step_video || false,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update project step status",
      },
      { status: 500 }
    );
  }
}

