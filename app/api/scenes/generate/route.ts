import { NextRequest, NextResponse } from "next/server";
import { qwen2Client } from "@/lib/dashscope/qwen2";
import { wanXImageClient } from "@/lib/dashscope/wanx-image";
import { tosClient } from "@/lib/volcano/storage";
import { createClient } from "@/lib/supabase/server";
import { createScene } from "@/lib/supabase/scenes";

/**
 * POST /api/scenes/generate
 * 生成故事分镜
 * 使用通义千问（Qwen2）生成分镜，通义万相生成图像（依次提交和查询）
 * 流程：
 * 1. 生成分镜JSON后立即保存到数据库（图片URL为null）
 * 2. 图片生成成功后，更新数据库中的图片URL
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const prompt = formData.get("prompt") as string | null;
    const storyContentStr = formData.get("storyContent") as string | null;
    const projectIdStr = formData.get("projectId") as string | null;
    const referenceImage = formData.get("referenceImage") as File | null;
    const readerGroup = (formData.get("readerGroup") as string) || "全年龄";
    const style = (formData.get("style") as string) || "2d"; // 风格参数

    // 检查是否有已生成的故事内容，或者需要生成
    let storyboardData;
    
    if (storyContentStr) {
      // 使用已生成的故事内容
      try {
        storyboardData = JSON.parse(storyContentStr);
        // 更新风格（如果用户修改了）
        if (style && storyboardData.style !== style) {
          storyboardData.style = style;
        }
      } catch (error) {
        console.error("Error parsing story content:", error);
        return NextResponse.json(
          { error: "Invalid story content format" },
          { status: 400 }
        );
      }
    } else if (prompt && prompt.trim()) {
      // 尝试从项目数据中获取故事大纲和角色列表
      let storyOutline: any = null;
      let characters: any[] | undefined = undefined;
      
      if (projectIdStr) {
        try {
          const supabase = await createClient();
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            // 查询项目数据（包括story_outline）
            const { data: projectData, error: projectError } = await supabase
              .from('anim_storyboard_projects')
              .select('story_outline')
              .eq('id', projectIdStr)
              .eq('user_id', user.id)
              .single();
            
            if (!projectError && projectData?.story_outline) {
              storyOutline = projectData.story_outline;
              if (storyOutline.characters) {
                characters = storyOutline.characters;
              }
            }
          }
        } catch (error) {
          console.error("Error fetching project data:", error);
          // 继续使用prompt生成，不中断流程
        }
      }
      
      // 使用新格式生成分镜（如果有storyOutline和characters）
      storyboardData = await qwen2Client.generateStoryboard({
        prompt,
        style: style,
        storyOutline: storyOutline,
        characters: characters,
      });
    } else {
      return NextResponse.json(
        { error: "Either prompt or storyContent is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'anonymous';

    // 获取主角图像URL（用于图片生成的参考图片）
    let mainCharacterImageUrl: string | null = null;
    if (projectIdStr && user) {
      try {
        const { data: projectData, error: projectError } = await supabase
          .from('anim_storyboard_projects')
          .select('story_outline, character_design')
          .eq('id', projectIdStr)
          .eq('user_id', user.id)
          .single();
        
        if (!projectError && projectData) {
          // 查找主角的图像URL
          if (projectData.story_outline?.characters && Array.isArray(projectData.story_outline.characters)) {
            const mainCharacter = projectData.story_outline.characters.find((char: any) => 
              char.role === 'Protagonist' || char.role === '主角' || char.role_type === 'main'
            ) || projectData.story_outline.characters[0];
            
            if (mainCharacter && projectData.character_design) {
              try {
                const characterDesign = typeof projectData.character_design === 'string'
                  ? JSON.parse(projectData.character_design)
                  : projectData.character_design;
                
                if (Array.isArray(characterDesign)) {
                  const charDesign = characterDesign.find((c: any) => 
                    c.id === mainCharacter.id || c.name === mainCharacter.name
                  );
                  if (charDesign?.imageUrl) {
                    mainCharacterImageUrl = charDesign.imageUrl;
                  }
                }
              } catch (e) {
                console.error("Error parsing character_design:", e);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching main character image:", error);
        // 继续执行，不中断流程
      }
    }

    // 步骤2: 立即保存分镜脚本到数据库（图片URL为null，后续会更新）
    if (!storyboardData.scenes || !Array.isArray(storyboardData.scenes)) {
      return NextResponse.json(
        { error: "Invalid storyboard data: scenes array is missing or invalid" },
        { status: 400 }
      );
    }

    const scene = await createScene({
      title: storyboardData.title,
      summary: storyboardData.summary,
      coverImageUrl: null, // 封面图稍后更新
      scenes: storyboardData.scenes.map((scene: any) => ({
        sceneNumber: scene.scene_id,
        text: scene.description,
        sceneDetail: scene.description,
        sceneTitle: scene.scene_title,
        camera: scene.camera,
        dialogue: scene.dialogue,
        sceneDuration: scene.duration,
        imageUrl: null, // 初始为null，图片生成成功后会更新
      })),
      fullJsonData: {
        title: storyboardData.title,
        summary: storyboardData.summary,
        style: storyboardData.style,
        scenes: storyboardData.scenes,
        originalPrompt: prompt,
        readerGroup: readerGroup,
      },
    });

    // 获取分镜项ID（用于后续更新图片URL）
    const { data: sceneItems } = await supabase
      .from('anim_scene_items')
      .select('id, scene_number')
      .eq('scene_id', scene.id)
      .order('scene_number', { ascending: true });

    // 检查是否使用SSE流式响应
    const useStreaming = request.headers.get('accept')?.includes('text/event-stream');
    
    if (useStreaming) {
      // 使用SSE流式响应
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const sendEvent = (event: string, data: any) => {
            const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));
          };
          
          try {
            // 先发送分镜数据
            sendEvent('scenes', {
              sceneId: scene.id,
              title: storyboardData.title,
              summary: storyboardData.summary,
              scenes: storyboardData.scenes.map((s: any, idx: number) => ({
                sceneNumber: s.scene_id || idx + 1,
                text: s.description || "",
                sceneDetail: s.description || "",
                sceneTitle: s.scene_title || "",
                camera: s.camera || "",
                dialogue: s.dialogue || [],
                duration: s.duration || "5",
                sceneItemId: sceneItems?.[idx]?.id,
              })),
            });
            
            // 依次提交图像生成任务，等待每个完成后再提交下一个
            for (let i = 0; i < storyboardData.scenes.length; i++) {
              const sceneItem = sceneItems?.[i];
              const scene = storyboardData.scenes[i];
              
              // 发送开始生成事件
              sendEvent('image-start', {
                index: i,
                sceneItemId: sceneItem?.id,
                sceneNumber: scene.scene_id || i + 1,
              });
              
              try {
                // 提交图像生成任务
                const task = await wanXImageClient.submitImageTask({
                  prompt: scene.image_prompt,
                  style: style,
                  size: "1280*1280",
                  n: 1,
                  refImg: mainCharacterImageUrl || undefined,
                });
                
                // 轮询等待图片生成完成
                let imageUrl: string | null = null;
                try {
                  const status = await wanXImageClient.pollImageTaskStatus(task.taskId);
                  
                  if (status.status === "SUCCEEDED" && status.images && status.images.length > 0) {
                    // 上传图片到TOS
                    try {
                      const filename = `${userId}/scene-${Date.now()}-${task.taskId}.png`;
                      imageUrl = await tosClient.uploadImageFromUrl(status.images[0], filename);
                      
                      // 更新数据库中的图片URL
                      if (sceneItem?.id) {
                        const { error: updateError } = await supabase
                          .from('anim_scene_items')
                          .update({ image_url: imageUrl })
                          .eq('id', sceneItem.id);
                        
                        if (updateError) {
                          console.error(`Error updating scene item image for scene ${i + 1}:`, updateError);
                        }
                      }
                    } catch (uploadError) {
                      console.error(`Error uploading image for scene ${i + 1}:`, uploadError);
                      imageUrl = status.images[0];
                    }
                  }
                } catch (pollError) {
                  console.error(`Error polling image status for scene ${i + 1}:`, pollError);
                }
                
                // 发送完成事件
                sendEvent('image-complete', {
                  index: i,
                  sceneItemId: sceneItem?.id,
                  sceneNumber: scene.scene_id || i + 1,
                  imageUrl: imageUrl,
                  success: !!imageUrl,
                });
              } catch (error) {
                console.error(`Error submitting image task for scene ${i + 1}:`, error);
                // 发送失败事件
                sendEvent('image-complete', {
                  index: i,
                  sceneItemId: sceneItem?.id,
                  sceneNumber: scene.scene_id || i + 1,
                  imageUrl: null,
                  success: false,
                });
              }
            }
            
            // 发送完成事件
            sendEvent('done', {});
            controller.close();
          } catch (error) {
            sendEvent('error', {
              error: error instanceof Error ? error.message : "Unknown error",
            });
            controller.close();
          }
        },
      });
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
    
    // 非流式响应（保持向后兼容）
    const scenesWithTasks = [];
    
    for (let i = 0; i < storyboardData.scenes.length; i++) {
      const sceneItem = sceneItems?.[i];
      const scene = storyboardData.scenes[i];
      
      try {
        // 提交图像生成任务
        const task = await wanXImageClient.submitImageTask({
          prompt: scene.image_prompt,
          style: style,
          size: "1280*1280",
          n: 1,
          refImg: mainCharacterImageUrl || undefined,
        });
        
        // 轮询等待图片生成完成
        let imageUrl: string | null = null;
        try {
          const status = await wanXImageClient.pollImageTaskStatus(task.taskId);
          
          if (status.status === "SUCCEEDED" && status.images && status.images.length > 0) {
            try {
              const filename = `${userId}/scene-${Date.now()}-${task.taskId}.png`;
              imageUrl = await tosClient.uploadImageFromUrl(status.images[0], filename);
              
              if (sceneItem?.id) {
                const { error: updateError } = await supabase
                  .from('anim_scene_items')
                  .update({ image_url: imageUrl })
                  .eq('id', sceneItem.id);
                
                if (updateError) {
                  console.error(`Error updating scene item image for scene ${i + 1}:`, updateError);
                }
              }
            } catch (uploadError) {
              console.error(`Error uploading image for scene ${i + 1}:`, uploadError);
              imageUrl = status.images[0];
            }
          }
        } catch (pollError) {
          console.error(`Error polling image status for scene ${i + 1}:`, pollError);
        }
        
        scenesWithTasks.push({
          ...scene,
          imageTaskId: task.taskId,
          imageUrl: imageUrl,
          imageGenerationFailed: !imageUrl,
          sceneItemId: sceneItem?.id,
        });
      } catch (error) {
        console.error(`Error submitting image task for scene ${i + 1}:`, error);
        scenesWithTasks.push({
          ...scene,
          imageTaskId: null,
          imageUrl: null,
          imageGenerationFailed: true,
          sceneItemId: sceneItem?.id,
        });
      }
    }

    // 步骤4: 组装结果（返回sceneId、sceneItemId和imageTaskId）
    if (!scenesWithTasks || !Array.isArray(scenesWithTasks)) {
      return NextResponse.json(
        { error: "Invalid scenes data: scenesWithTasks is missing or invalid" },
        { status: 500 }
      );
    }

    const result = {
      sceneId: scene.id, // 返回sceneId
      title: storyboardData.title,
      summary: storyboardData.summary,
      scenes: scenesWithTasks.map((scene, index) => {
        const originalScene = storyboardData.scenes[index] || {};
        return {
          text: scene.description || originalScene.description || "",
          sceneDetail: scene.description || originalScene.description || "",
          imageUrl: scene.imageUrl || null, // 初始为null，生成成功后更新
          imageTaskId: scene.imageTaskId || null, // 图片生成任务ID，用于前端轮询
          sceneNumber: originalScene.scene_id || scene.scene_id || index + 1,
          sceneTitle: originalScene.scene_title || scene.scene_title || "",
          camera: originalScene.camera || scene.camera || "",
          dialogue: originalScene.dialogue || scene.dialogue || [],
          duration: originalScene.duration || scene.duration || "5",
          imageGenerationFailed: scene.imageGenerationFailed || false,
          sceneItemId: scene.sceneItemId, // 返回sceneItemId用于前端更新
        };
      }),
      // 保存完整的 JSON 数据（新格式）
      fullJsonData: {
        title: storyboardData.title,
        summary: storyboardData.summary,
        style: storyboardData.style,
        scenes: scenesWithTasks.map((scene, index) => ({
          ...(storyboardData.scenes[index] || {}),
          imageTaskId: scene.imageTaskId,
        })),
        originalPrompt: prompt,
        readerGroup: readerGroup,
      },
    };

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error generating scenes:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate scenes",
      },
      { status: 500 }
    );
  }
}

