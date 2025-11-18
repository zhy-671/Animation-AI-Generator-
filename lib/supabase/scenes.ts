import { createClient } from '@/lib/supabase/server'
import type { AnimCustomer } from '@/lib/supabase/types'

export interface AnimScene {
  id: string
  user_id: string
  title: string
  summary: string
  cover_image_url: string | null
  created_at: string
  updated_at: string
  metadata: Record<string, any>
}

export interface AnimSceneItem {
  id: string
  scene_id: string
  scene_number: number
  text: string
  scene_detail: string | null // 画面描述
  image_url: string | null
  video_url: string | null
  created_at: string
  updated_at: string
  metadata: Record<string, any>
}

export interface AnimVideo {
  id: string
  user_id: string
  scene_item_id: string | null
  video_url: string
  prompt: string | null
  image_url: string | null
  resolution: string
  task_id: string | null
  request_id: string | null // DashScope API 请求ID
  status: 'pending' | 'processing' | 'completed' | 'failed'
  submit_time: string | null // DashScope API 任务提交时间
  scheduled_time: string | null // DashScope API 任务计划执行时间
  end_time: string | null // DashScope API 任务结束时间
  orig_prompt: string | null // DashScope API 原始提示词
  actual_prompt: string | null // DashScope API 实际使用的提示词
  duration: number | null // 视频时长（秒）
  video_count: number | null // 视频数量
  sr: number | null // 采样率/分辨率
  created_at: string
  updated_at: string
  metadata: Record<string, any>
}

export interface CreateSceneRequest {
  title: string
  summary: string
  coverImageUrl?: string | null
  scenes: Array<{
    sceneNumber: number
    text: string
    sceneDetail?: string // 画面描述
    sceneTitle?: string // 场景标题
    camera?: string // 镜头语言
    dialogue?: string[] // 对白
    sceneDuration?: string // 场景持续时间
    imageUrl?: string | null
  }>
  fullJsonData?: Record<string, any> // 完整的 JSON 数据，存储到 metadata
}

/**
 * 创建分镜
 */
export async function createScene(data: CreateSceneRequest): Promise<AnimScene> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User not authenticated')
  }

  // 创建分镜主记录
  const { data: scene, error: sceneError } = await supabase
    .from('anim_scenes')
    .insert({
      user_id: user.id,
      title: data.title,
      summary: data.summary,
      cover_image_url: data.coverImageUrl || null,
      metadata: data.fullJsonData ? data.fullJsonData : {}, // 存储完整的 JSON 数据
    })
    .select()
    .single()

  if (sceneError || !scene) {
    throw new Error(`Failed to create scene: ${sceneError?.message}`)
  }

  // 创建分镜详情记录
  if (data.scenes && data.scenes.length > 0) {
    const sceneItems = data.scenes.map(item => ({
      scene_id: scene.id,
      scene_number: item.sceneNumber,
      text: item.text,
      scene_detail: item.sceneDetail || null, // 保存画面描述
      metadata: {
        scene_title: item.sceneTitle || null, // 场景标题
        camera: item.camera || null, // 镜头语言
        dialogue: item.dialogue || null, // 对白
        scene_duration: item.sceneDuration || null, // 场景持续时间
      },
      image_url: item.imageUrl || null,
    }))

    const { error: itemsError } = await supabase
      .from('anim_scene_items')
      .insert(sceneItems)

    if (itemsError) {
      // 如果插入失败，删除已创建的分镜主记录
      await supabase.from('anim_scenes').delete().eq('id', scene.id)
      throw new Error(`Failed to create scene items: ${itemsError.message}`)
    }
  }

  return scene as AnimScene
}

/**
 * 获取用户的所有分镜
 */
export async function getUserScenes(): Promise<AnimScene[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('anim_scenes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to get scenes: ${error.message}`)
  }

  return (data || []) as AnimScene[]
}

/**
 * 获取分镜详情（包含所有分镜项）
 */
export async function getSceneWithItems(sceneId: string): Promise<AnimScene & { items: AnimSceneItem[] } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // 获取分镜主记录
  const { data: scene, error: sceneError } = await supabase
    .from('anim_scenes')
    .select('*')
    .eq('id', sceneId)
    .eq('user_id', user.id)
    .single()

  if (sceneError || !scene) {
    return null
  }

  // 获取分镜项
  const { data: items, error: itemsError } = await supabase
    .from('anim_scene_items')
    .select('*')
    .eq('scene_id', sceneId)
    .order('scene_number', { ascending: true })

  if (itemsError) {
    throw new Error(`Failed to get scene items: ${itemsError.message}`)
  }

  return {
    ...(scene as AnimScene),
    items: (items || []) as AnimSceneItem[],
  }
}

/**
 * 通过 project_id 查找分镜（通过 metadata.project_id）
 */
export async function getSceneByProjectId(projectId: string): Promise<AnimScene & { items: AnimSceneItem[] } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // 直接通过 project_id 列查询（新表结构）
  const { data: scene, error: scenesError } = await supabase
    .from('anim_scenes')
    .select('*')
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .maybeSingle()

  if (scenesError) {
    throw new Error(`Failed to get scene: ${scenesError.message}`)
  }

  if (!scene) {
    return null
  }

  // 获取分镜项
  const { data: items, error: itemsError } = await supabase
    .from('anim_scene_items')
    .select('*')
    .eq('scene_id', scene.id)
    .order('scene_number', { ascending: true })

  if (itemsError) {
    throw new Error(`Failed to get scene items: ${itemsError.message}`)
  }

  return {
    ...(scene as AnimScene),
    items: (items || []) as AnimSceneItem[],
  }
}

/**
 * 更新分镜项的图片
 */
export async function updateSceneItemImage(sceneItemId: string, imageUrl: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User not authenticated')
  }

  // 验证用户是否有权限更新这个分镜项
  const { data: sceneItem, error: checkError } = await supabase
    .from('anim_scene_items')
    .select('scene_id, anim_scenes!inner(user_id)')
    .eq('id', sceneItemId)
    .single()

  if (checkError || !sceneItem) {
    throw new Error('Scene item not found')
  }

  // 更新图片URL
  const { error: updateError } = await supabase
    .from('anim_scene_items')
    .update({ image_url: imageUrl })
    .eq('id', sceneItemId)

  if (updateError) {
    throw new Error(`Failed to update scene item image: ${updateError.message}`)
  }
}

/**
 * 删除分镜项的图片
 */
export async function deleteSceneItemImage(sceneItemId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User not authenticated')
  }

  // 验证用户是否有权限
  const { data: sceneItem, error: checkError } = await supabase
    .from('anim_scene_items')
    .select('scene_id, anim_scenes!inner(user_id)')
    .eq('id', sceneItemId)
    .single()

  if (checkError || !sceneItem) {
    throw new Error('Scene item not found')
  }

  // 清空图片URL
  const { error: updateError } = await supabase
    .from('anim_scene_items')
    .update({ image_url: null })
    .eq('id', sceneItemId)

  if (updateError) {
    throw new Error(`Failed to delete scene item image: ${updateError.message}`)
  }
}

/**
 * 更新分镜项的文本
 */
export async function updateSceneItemText(sceneItemId: string, text: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User not authenticated')
  }

  // 验证用户是否有权限
  const { data: sceneItem, error: checkError } = await supabase
    .from('anim_scene_items')
    .select('scene_id, anim_scenes!inner(user_id)')
    .eq('id', sceneItemId)
    .single()

  if (checkError || !sceneItem) {
    throw new Error('Scene item not found')
  }

  const { error: updateError } = await supabase
    .from('anim_scene_items')
    .update({ text })
    .eq('id', sceneItemId)

  if (updateError) {
    throw new Error(`Failed to update scene item text: ${updateError.message}`)
  }
}

/**
 * 创建或更新视频记录
 * sceneItemId 可以为 null（非分镜模式）
 */
export async function createOrUpdateVideo(data: {
  sceneItemId?: string | null // 可选，非分镜模式时为 null
  videoUrl: string
  prompt?: string
  sceneDetail?: string // 画面描述
  imageUrl?: string
  resolution?: string
  taskId?: string
  requestId?: string // DashScope API 请求ID
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  submitTime?: string // DashScope API 任务提交时间
  scheduledTime?: string // DashScope API 任务计划执行时间
  endTime?: string // DashScope API 任务结束时间
  origPrompt?: string // DashScope API 原始提示词
  actualPrompt?: string // DashScope API 实际使用的提示词
  duration?: number // 视频时长（秒）
  videoCount?: number // 视频数量
  sr?: number // 采样率/分辨率
  shotNumber?: number // 分镜编号，用于更新metadata.storyboard.shots
}): Promise<AnimVideo> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User not authenticated')
  }

  // 检查是否已存在视频记录
  // 如果有 sceneItemId，按 sceneItemId 查找；否则按 taskId 查找
  let existingVideo = null;
  if (data.sceneItemId) {
    const { data: existing } = await supabase
      .from('anim_videos')
      .select('*')
      .eq('scene_item_id', data.sceneItemId)
      .eq('user_id', user.id)
      .single()
    existingVideo = existing;
  } else if (data.taskId) {
    const { data: existing } = await supabase
      .from('anim_videos')
      .select('*')
      .eq('task_id', data.taskId)
      .eq('user_id', user.id)
      .is('scene_item_id', null) // 非分镜模式
      .single()
    existingVideo = existing;
  }

  if (existingVideo) {
    // 更新现有记录
    const { data: video, error } = await supabase
      .from('anim_videos')
      .update({
        video_url: data.videoUrl,
        prompt: data.prompt || null,
        image_url: data.imageUrl || null,
        thumbnail_url: data.imageUrl || null, // 使用 imageUrl 作为缩略图
        resolution: data.resolution || '1080P',
        task_id: data.taskId || null,
        request_id: data.requestId || null,
        status: data.status || 'completed',
        submit_time: data.submitTime || null,
        scheduled_time: data.scheduledTime || null,
        end_time: data.endTime || null,
        orig_prompt: data.origPrompt || null,
        actual_prompt: data.actualPrompt || null,
        duration: data.duration || null,
        video_count: data.videoCount || null,
        sr: data.sr || null,
        metadata: {
          sceneDetail: data.sceneDetail || null, // 保存画面描述到 metadata
        },
      })
      .eq('id', existingVideo.id)
      .select()
      .single()

    if (error || !video) {
      throw new Error(`Failed to update video: ${error?.message}`)
    }

    // 如果有 sceneItemId，同时更新分镜项的 video_url 和 metadata.storyboard.shots
    if (data.sceneItemId) {
      // 更新 video_url 字段
      await supabase
        .from('anim_scene_items')
        .update({ video_url: data.videoUrl })
        .eq('id', data.sceneItemId)

      // 如果有 shotNumber，同时更新 metadata.storyboard.shots[shotNumber].video_url
      if (data.shotNumber !== undefined) {
        // 获取当前的 metadata
        const { data: sceneItem } = await supabase
          .from('anim_scene_items')
          .select('metadata')
          .eq('id', data.sceneItemId)
          .single()

        if (sceneItem?.metadata?.storyboard?.shots) {
          const updatedShots = sceneItem.metadata.storyboard.shots.map((shot: any) => {
            if (shot.shot_number === data.shotNumber) {
              return { ...shot, video_url: data.videoUrl }
            }
            return shot
          })

          // 更新 metadata
          await supabase
            .from('anim_scene_items')
            .update({
              metadata: {
                ...sceneItem.metadata,
                storyboard: {
                  ...sceneItem.metadata.storyboard,
                  shots: updatedShots,
                },
              },
            })
            .eq('id', data.sceneItemId)
        }
      }
    }

    return video as AnimVideo
  } else {
    // 创建新记录
    const { data: video, error } = await supabase
      .from('anim_videos')
      .insert({
        user_id: user.id,
        scene_item_id: data.sceneItemId,
        video_url: data.videoUrl,
        prompt: data.prompt || null,
        image_url: data.imageUrl || null,
        thumbnail_url: data.imageUrl || null, // 使用 imageUrl 作为缩略图
        resolution: data.resolution || '1080P',
        task_id: data.taskId || null,
        request_id: data.requestId || null,
        status: data.status || 'completed',
        submit_time: data.submitTime || null,
        scheduled_time: data.scheduledTime || null,
        end_time: data.endTime || null,
        orig_prompt: data.origPrompt || null,
        actual_prompt: data.actualPrompt || null,
        duration: data.duration || null,
        video_count: data.videoCount || null,
        sr: data.sr || null,
        metadata: {
          sceneDetail: data.sceneDetail || null, // 保存画面描述到 metadata
        },
      })
      .select()
      .single()

    if (error || !video) {
      throw new Error(`Failed to create video: ${error?.message}`)
    }

    // 如果有 sceneItemId，同时更新分镜项的 video_url 和 metadata.storyboard.shots
    if (data.sceneItemId) {
      // 更新 video_url 字段
      await supabase
        .from('anim_scene_items')
        .update({ video_url: data.videoUrl })
        .eq('id', data.sceneItemId)

      // 如果有 shotNumber，同时更新 metadata.storyboard.shots[shotNumber].video_url
      if (data.shotNumber !== undefined) {
        // 获取当前的 metadata
        const { data: sceneItem } = await supabase
          .from('anim_scene_items')
          .select('metadata')
          .eq('id', data.sceneItemId)
          .single()

        if (sceneItem?.metadata?.storyboard?.shots) {
          const updatedShots = sceneItem.metadata.storyboard.shots.map((shot: any) => {
            if (shot.shot_number === data.shotNumber) {
              return { ...shot, video_url: data.videoUrl }
            }
            return shot
          })

          // 更新 metadata
          await supabase
            .from('anim_scene_items')
            .update({
              metadata: {
                ...sceneItem.metadata,
                storyboard: {
                  ...sceneItem.metadata.storyboard,
                  shots: updatedShots,
                },
              },
            })
            .eq('id', data.sceneItemId)
        }
      }
    }

    return video as AnimVideo
  }
}

/**
 * 删除视频
 */
export async function deleteVideo(sceneItemId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User not authenticated')
  }

  // 删除视频记录
  const { error: videoError } = await supabase
    .from('anim_videos')
    .delete()
    .eq('scene_item_id', sceneItemId)
    .eq('user_id', user.id)

  if (videoError) {
    throw new Error(`Failed to delete video: ${videoError.message}`)
  }

  // 清空分镜项的 video_url
  const { error: itemError } = await supabase
    .from('anim_scene_items')
    .update({ video_url: null })
    .eq('id', sceneItemId)

  if (itemError) {
    throw new Error(`Failed to update scene item: ${itemError.message}`)
  }
}

/**
 * 删除分镜
 */
export async function deleteScene(sceneId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User not authenticated')
  }

  // 删除分镜（级联删除分镜项和关联的视频）
  const { error } = await supabase
    .from('anim_scenes')
    .delete()
    .eq('id', sceneId)
    .eq('user_id', user.id)

  if (error) {
    throw new Error(`Failed to delete scene: ${error.message}`)
  }
}

