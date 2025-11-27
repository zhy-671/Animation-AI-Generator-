import { NextRequest, NextResponse } from "next/server";
import { wanXImageClient } from "@/lib/dashscope/wanx-image";
import { tosClient } from "@/lib/volcano/storage";
import { createClient } from "@/lib/supabase/server";
import { createScene } from "@/lib/supabase/scenes";

function convertAspectRatioToSize(aspectRatio: string): string {
  if (aspectRatio.includes("*")) {
    return aspectRatio;
  }

  const parts = aspectRatio.split(":");
  if (parts.length !== 2) {
    return "1920*1080";
  }

  const widthRatio = parseFloat(parts[0]);
  const heightRatio = parseFloat(parts[1]);

  if (
    isNaN(widthRatio) ||
    isNaN(heightRatio) ||
    widthRatio <= 0 ||
    heightRatio <= 0
  ) {
    return "1920*1080";
  }

  // 注意：API要求图片大小必须至少 921600 像素（约 960*960）
  if (widthRatio / heightRatio === 16 / 9) {
    // 16:9 -> 1920*1080 (2,073,600 像素，满足要求)
    return "1920*1080";
  } else if (widthRatio / heightRatio === 4 / 3) {
    // 4:3 -> 1280*960 (1,228,800 像素，满足要求，之前 1024*768 太小)
    return "1280*960";
  } else if (widthRatio / heightRatio === 1) {
    // 1:1 -> 1024*1024 (1,048,576 像素，满足要求)
    return "1024*1024";
  } else if (widthRatio / heightRatio === 9 / 16) {
    // 9:16 (竖屏) -> 720*1280 (921,600 像素，刚好满足要求，之前 576*1024 太小)
    return "720*1280";
  } else if (widthRatio / heightRatio === 21 / 9) {
    // 21:9 (超宽屏) -> 2560*1080 (2,764,800 像素，满足要求)
    return "2560*1080";
  } else {
    // 其他比例，使用通用计算方式，确保至少 921600 像素
    const minPixels = 921600;
    let baseHeight = 1024;
    let calculatedWidth = Math.round((widthRatio / heightRatio) * baseHeight);
    let totalPixels = calculatedWidth * baseHeight;
    
    // 如果像素数不足，按比例放大
    if (totalPixels < minPixels) {
      const scale = Math.sqrt(minPixels / totalPixels);
      baseHeight = Math.round(baseHeight * scale);
      calculatedWidth = Math.round((widthRatio / heightRatio) * baseHeight);
      // 确保是偶数（某些API要求）
      baseHeight = baseHeight % 2 === 0 ? baseHeight : baseHeight + 1;
      calculatedWidth = calculatedWidth % 2 === 0 ? calculatedWidth : calculatedWidth + 1;
    } else {
      // 确保宽度是偶数（某些API要求）
      calculatedWidth = calculatedWidth % 2 === 0 ? calculatedWidth : calculatedWidth + 1;
    }
    
    return `${calculatedWidth}*${baseHeight}`;
  }
}

interface StoryboardSceneData {
  scene_id?: number | string;
  scene_title?: string;
  description?: string;
  camera?: string;
  dialogue?: string[];
  image_prompt?: string;
  duration?: string;
}

interface StoryboardData {
  title?: string;
  summary?: string;
  style?: string;
  scenes: StoryboardSceneData[];
}

const LAOZHANG_ENDPOINT = "https://api.laozhang.ai/v1/chat/completions";
const LAOZHANG_MODEL =
  process.env.LAOZHANG_STORYBOARD_MODEL ||
  process.env.LAOZHANG_MODEL ||
  "gpt-4o-mini";

const STYLE_PROMPTS: Record<string, string> = {
  "2d": "2D animation aesthetics, expressive line work, stylized motion",
  "3d": "3D cinematic lighting, depth-rich set design, realistic rendering",
  anime:
    "Japanese anime cinematography, vibrant gradients, dynamic angles, stylized characters",
  cyberpunk:
    "Cyberpunk neon backdrops, holographic signage, rain-soaked streets, high-tech low-life mood",
  clay: "Clay stop-motion look, handcrafted textures, soft lighting, miniature props",
  comic:
    "Western comic framing, bold inks, halftone textures, dramatic poses and action lines",
  cartoon:
    "Stylized cartoon palette, saturated colors, exaggerated poses, playful transitions",
  realistic:
    "Stylized realism, cinematic composition, 8K production quality, physically based lighting",
};

const LAOZHANG_STORYBOARD_SYSTEM_PROMPT = `LANGUAGE REQUIREMENT: Respond in valid JSON only. Do not include commentary.

You are the lead storyboard showrunner for global music videos. Take lyrics, themes, and character notes from the user and craft a cinematic storyboard ready for animation and AI image generation.

Output JSON schema:
{
  "title": "Overall project title",
  "summary": "One sentence synopsis",
  "style": "Visual direction string",
  "scenes": [
    {
      "scene_id": 1,
      "scene_title": "Scene heading (5-10 words)",
      "description": "Cinematic description describing environment, choreography, emotions, lighting, and transitions in <= 120 words",
      "camera": "Camera language describing lens, movement, framing, atmosphere",
      "dialogue": ["Optional lyric excerpts, chants, or sound design notes"],
      "image_prompt": "High quality English prompt (<=80 words) mentioning setting, lighting, mood, costume, and style. Avoid camera jargon.",
      "duration": "5"
    }
  ]
}

Creative guardrails:
1. 5-8 scenes following intro -> build -> chorus -> bridge -> outro.
2. Maintain performer identity, wardrobe, and set continuity unless deliberate change.
3. Camera notes must feel like real directing instructions.
4. Dialogue can include selected lyric lines, chants, or SFX cues; omit when empty.
5. image_prompt must be PG-13 and avoid disallowed content.
6. style should echo requested visual direction or inferred mood.
7. Always return valid JSON without markdown fences.`;

const extractJsonFromContent = (content: string) => {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/```(?:json)?([\s\S]*?)```/i);
  const target = fencedMatch ? fencedMatch[1].trim() : trimmed;

  try {
    return JSON.parse(target);
  } catch (error) {
    const firstBrace = target.indexOf("{");
    const lastBrace = target.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(target.slice(firstBrace, lastBrace + 1));
    }
    throw error;
  }
};

const buildStoryboardUserPrompt = ({
  prompt,
  style,
  readerGroup,
  characters,
}: {
  prompt: string;
  style?: string;
  readerGroup?: string;
  characters?: any[];
}) => {
  const sections: string[] = [];
  sections.push(`Song / Story Brief:\n${prompt.trim()}`);

  if (readerGroup) {
    sections.push(`Target Audience: ${readerGroup}`);
  }

  if (style) {
    sections.push(
      `Visual Style Preference: ${
        STYLE_PROMPTS[style] || "Cinematic music video aesthetics"
      }`
    );
  }

  if (characters && characters.length > 0) {
    const characterText = characters
      .map((char: any, index: number) => {
        if (!char) return `Character ${index + 1}`;
        const name =
          char.name || char.角色名称 || char.role || `Character ${index + 1}`;
        const desc =
          char.description ||
          char.personality ||
          char.role_description ||
          "";
        return `${name}: ${desc}`;
      })
      .join("\n");
    sections.push(`Character Notes:\n${characterText}`);
  }

  sections.push(
    "Instructions: Craft a complete storyboard JSON covering intro, verses, choruses, bridge, and outro. Each scene must highlight lighting, mood, and environment."
  );

  return sections.join("\n\n");
};

const generateStoryboardWithLaozhang = async ({
  prompt,
  style,
  readerGroup,
  characters,
}: {
  prompt: string;
  style?: string;
  readerGroup?: string;
  characters?: any[];
}): Promise<StoryboardData> => {
  const apiKey = process.env.LAOZHANG_API_KEY;
  if (!apiKey) {
    throw new Error("LAOZHANG_API_KEY is not configured");
  }

  const userPrompt = buildStoryboardUserPrompt({
    prompt,
    style,
    readerGroup,
    characters,
  });

  const response = await fetch(LAOZHANG_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: LAOZHANG_MODEL,
      temperature: 0.65,
      max_tokens: 4000,
      messages: [
        { role: "system", content: LAOZHANG_STORYBOARD_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Laozhang API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = await response.json();
  const aiContent = data?.choices?.[0]?.message?.content?.trim();
  if (!aiContent) {
    throw new Error("Empty response from LaoZhang API");
  }

  const parsed = extractJsonFromContent(aiContent);
  if (!parsed || !Array.isArray(parsed.scenes)) {
    throw new Error("Invalid storyboard data returned by LaoZhang API");
  }

  return {
    title: parsed.title || "Music Video Storyboard",
    summary: parsed.summary || "",
    style: parsed.style || style || "music-video",
    scenes: parsed.scenes,
  };
};

const buildSceneImagePrompt = (scene: any, storyboardTitle: string) => {
  if (
    scene?.image_prompt &&
    typeof scene.image_prompt === "string" &&
    scene.image_prompt.trim()
  ) {
    return scene.image_prompt.trim();
  }

  if (
    scene?.description &&
    typeof scene.description === "string" &&
    scene.description.trim()
  ) {
    return scene.description.trim();
  }

  const sceneTitle =
    (typeof scene?.scene_title === "string" && scene.scene_title.trim()) ||
    `Scene ${scene?.scene_id || ""}`;

  return `${storyboardTitle} - ${sceneTitle}. Cinematic keyframe, dynamic lighting, professional color grading, ultra detailed.`;
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const prompt = formData.get("prompt") as string | null;
    const readerGroup = (formData.get("readerGroup") as string) || "All Ages";
    let style = (formData.get("style") as string) || "2d";
    let artSetting = (formData.get("artSetting") as string) || "16:9";

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id || "anonymous";

    const storyboardData = await generateStoryboardWithLaozhang({
      prompt,
      style,
      readerGroup,
    });

    if (!storyboardData.scenes || !Array.isArray(storyboardData.scenes)) {
      return NextResponse.json(
        { error: "Invalid storyboard data" },
        { status: 400 }
      );
    }

    const storyboardTitle = storyboardData.title || "Music Video Storyboard";
    const storyboardSummary = storyboardData.summary || "";

    const scene = await createScene({
      title: storyboardTitle,
      summary: storyboardSummary,
      coverImageUrl: null,
      scenes: storyboardData.scenes.map((scene: any) => ({
        sceneNumber: scene.scene_id,
        text: scene.description || "",
        sceneDetail: scene.description || "",
        sceneTitle: scene.scene_title || "",
        camera: scene.camera || "",
        dialogue: Array.isArray(scene.dialogue) ? scene.dialogue : [],
        sceneDuration: scene.duration || "5",
        imageUrl: null,
      })),
      fullJsonData: {
        title: storyboardTitle,
        summary: storyboardSummary,
        style: storyboardData.style || style,
        scenes: storyboardData.scenes,
        originalPrompt: prompt,
        readerGroup,
        artSetting,
        source: "music-video",
      },
    });

    const { data: sceneItems } = await supabase
      .from("anim_scene_items")
      .select("id, scene_number")
      .eq("scene_id", scene.id)
      .order("scene_number", { ascending: true });

    const scenesWithTasks: any[] = [];

    for (let i = 0; i < storyboardData.scenes.length; i++) {
      const sceneItem = sceneItems?.[i];
      const currentScene = storyboardData.scenes[i];

      try {
        const imageSize = convertAspectRatioToSize(artSetting);
        const imagePrompt = buildSceneImagePrompt(currentScene, storyboardTitle);

        const imageRequestPayload = {
          prompt: imagePrompt,
          style,
          size: imageSize,
          n: 1,
        };

        const task = await wanXImageClient.submitImageTask(imageRequestPayload);

        let imageUrl: string | null = null;
        try {
          const status = await wanXImageClient.pollImageTaskStatus(task.taskId);
          if (status.status === "SUCCEEDED" && status.images?.length) {
            try {
              const filename = `${userId}/music-scene-${Date.now()}-${task.taskId}.png`;
              imageUrl = await tosClient.uploadImageFromUrl(status.images[0], filename);
              if (sceneItem?.id) {
                await supabase
                  .from("anim_scene_items")
                  .update({ image_url: imageUrl })
                  .eq("id", sceneItem.id);
              }
            } catch (uploadError) {
              imageUrl = status.images[0];
            }
          }
        } catch (pollError) {
        }

        scenesWithTasks.push({
          ...currentScene,
          imageTaskId: task.taskId,
          imageUrl,
          imageGenerationFailed: !imageUrl,
          sceneItemId: sceneItem?.id,
        });
      } catch (error) {
        scenesWithTasks.push({
          ...currentScene,
          imageTaskId: null,
          imageUrl: null,
          imageGenerationFailed: true,
          sceneItemId: sceneItem?.id,
        });
      }
    }

    const result = {
      sceneId: scene.id,
      title: storyboardTitle,
      summary: storyboardSummary,
      scenes: scenesWithTasks.map((sceneData, index) => {
        const originalScene = storyboardData.scenes[index] || {};
        return {
          text: sceneData.description || originalScene.description || "",
          sceneDetail: sceneData.description || originalScene.description || "",
          imageUrl: sceneData.imageUrl || null,
          imageTaskId: sceneData.imageTaskId || null,
          sceneNumber: originalScene.scene_id || sceneData.scene_id || index + 1,
          sceneTitle: originalScene.scene_title || sceneData.scene_title || "",
          camera: originalScene.camera || sceneData.camera || "",
          dialogue: originalScene.dialogue || sceneData.dialogue || [],
          duration: originalScene.duration || sceneData.duration || "5",
          imageGenerationFailed: sceneData.imageGenerationFailed || false,
          sceneItemId: sceneData.sceneItemId,
        };
      }),
      fullJsonData: {
        title: storyboardTitle,
        summary: storyboardSummary,
        style: storyboardData.style || style,
        scenes: scenesWithTasks.map((sceneData, index) => ({
          ...(storyboardData.scenes[index] || {}),
          imageTaskId: sceneData.imageTaskId,
        })),
        originalPrompt: prompt,
        readerGroup,
        artSetting,
        source: "music-video",
      },
    };

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate music storyboard",
      },
      { status: 500 }
    );
  }
}
