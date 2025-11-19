import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSceneByProjectId, getSceneWithItems } from '@/lib/supabase/scenes';
import archiver from 'archiver';

/**
 * GET /api/projects/[projectId]/download-videos?sceneId=xxx
 * 下载指定场景下的所有分镜视频，打包成zip文件
 * 如果提供了 sceneId，只下载该场景的视频；否则下载项目下第一个场景的视频
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const sceneId = searchParams.get('sceneId');
    const supabase = await createClient();

    // 验证用户身份
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let sceneData;

    // 如果提供了 sceneId，直接获取该场景
    if (sceneId) {
      sceneData = await getSceneWithItems(sceneId);
      if (!sceneData) {
        return NextResponse.json(
          { error: 'Scene not found' },
          { status: 404 }
        );
      }
      // 验证场景属于当前用户
      if (sceneData.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }
    } else {
      // 否则通过 projectId 获取场景（通常一个项目对应一个场景）
      sceneData = await getSceneByProjectId(projectId);
      if (!sceneData) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }
      // 验证项目属于当前用户
      if (sceneData.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }
    }

    // 收集所有视频URL
    const videoFiles: Array<{ url: string; filename: string }> = [];

    if (sceneData.items) {
      for (const item of sceneData.items) {
        // 检查是否有分镜数据（storyboard）
        if (item.metadata?.storyboard?.shots) {
          const shots = item.metadata.storyboard.shots;
          for (const shot of shots) {
            if (shot.video_url) {
              const filename = `Scene_${item.scene_number}_Shot_${shot.shot_number}.mp4`;
              videoFiles.push({
                url: shot.video_url,
                filename: filename,
              });
            }
          }
        } else if (item.video_url) {
          // 如果没有分镜，使用场景视频
          const filename = `Scene_${item.scene_number}.mp4`;
          videoFiles.push({
            url: item.video_url,
            filename: filename,
          });
        }
      }
    }

    if (videoFiles.length === 0) {
      return NextResponse.json(
        { error: 'No videos found in this project' },
        { status: 404 }
      );
    }

    // 设置响应头
    const projectTitle = sceneData.title || 'project';
    const safeTitle = projectTitle.replace(/[^a-zA-Z0-9]/g, '_');
    const zipFilename = `${safeTitle}_videos_${Date.now()}.zip`;

    // 创建zip文件流
    const archive = archiver('zip', {
      zlib: { level: 9 }, // 最高压缩级别
    });

    // 创建响应流
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    // 下载并添加每个视频到zip
    for (const { url, filename } of videoFiles) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.error(`Failed to download video: ${url}`);
          continue;
        }

        const buffer = await response.arrayBuffer();
        archive.append(Buffer.from(buffer), { name: filename });
      } catch (error) {
        console.error(`Error downloading video ${url}:`, error);
        // 继续处理其他视频，不中断整个流程
      }
    }

    // 完成zip文件
    archive.finalize();

    // 等待zip完成
    await new Promise<void>((resolve, reject) => {
      archive.on('end', resolve);
      archive.on('error', reject);
    });

    // 合并所有chunks
    const result = Buffer.concat(chunks);

    // 返回zip文件
    return new NextResponse(result, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Content-Length': result.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error creating video download:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create video download',
      },
      { status: 500 }
    );
  }
}

