import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserWithRetry } from "@/lib/supabase/auth-helper";

/**
 * GET /api/storyboard/characters
 * Get all characters for a project from anim_characters table
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

    // Query characters from anim_characters table
    const { data: characters, error: charactersError } = await supabase
      .from('anim_characters')
      .select('id, name, image_url, image_generation_prompt, resolution, visual_style, art_setting')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (charactersError) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch characters: ${charactersError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        characters: characters || [],
        count: characters?.length || 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch characters",
      },
      { status: 500 }
    );
  }
}

