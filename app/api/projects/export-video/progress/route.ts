import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceRoleClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type ExportTaskRow = {
  id: string;
  user_id: string;
  status: string;
  progress: number;
  video_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

type TaskLookupResult = {
  task: ExportTaskRow | null;
  ownershipMismatch: boolean;
};

async function fetchTaskForUser(
  supabase: SupabaseClient,
  taskId: string,
  userId: string
): Promise<TaskLookupResult> {
  // 首先直接查询任务是否存在（不检查 user_id），用于调试
  const { data: rawTask, error: rawError } = await supabase
    .from('project_export_tasks')
    .select('id, user_id, status, progress, video_url, error, created_at, updated_at')
    .eq('id', taskId)
    .maybeSingle();

  if (rawError) {
    return { task: null, ownershipMismatch: false };
  }

  if (!rawTask) {
    // 尝试查询最近的任务看看是否有类似的任务（用于调试）
    const { data: recentTasks, error: recentError } = await supabase
      .from('project_export_tasks')
      .select('id, user_id, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    // 也查询所有最近的任务（不限制 user_id），用于调试
    const { data: allRecentTasks } = await supabase
      .from('project_export_tasks')
      .select('id, user_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    return { task: null, ownershipMismatch: false };
  }
  if (rawTask.user_id !== userId) {
    return { task: null, ownershipMismatch: true };
  }

  return { task: rawTask, ownershipMismatch: false };
}

function buildTaskResponse(task: ExportTaskRow) {
  return {
    status: task.status,
    progress: task.progress,
    videoUrl: task.video_url,
    error: task.error,
    completed: task.status === 'completed' || task.status === 'error',
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json(
      { error: 'taskId is required' },
      { status: 400 }
    );
  }

  // 获取当前用户
  const userSupabase = await createClient();
  const { data: { user }, error: userError } = await userSupabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const adminSupabase = getServiceRoleClient();
  const { task, ownershipMismatch } = await fetchTaskForUser(adminSupabase, taskId, user.id);
  
  if (!task) {
    if (ownershipMismatch) {
      return NextResponse.json(
        { error: 'Not authorized to access this task' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Task not found' },
      { status: 404 }
    );
  }
  return NextResponse.json(buildTaskResponse(task));
}

