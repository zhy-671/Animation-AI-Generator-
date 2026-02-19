import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/storyboard/generate-script-doubao
 * 使用 gpt-4o-mini 模型生成剧本（通过 Laozhang API）
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { prompt } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // 使用 Laozhang API Key
    const apiKey = process.env.LAOZHANG_API_KEY_STORY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "LAOZHANG_API_KEY_STORY is not configured" },
        { status: 500 }
      );
    }

    // 构建系统提示词
    const systemPrompt = `LANGUAGE REQUIREMENT (CRITICAL): All output content MUST be in English only. No Chinese, Japanese, or any other non-English characters in the generated story.

You are a professional fiction author specializing in long, immersive, character-driven stories for an international audience.

Your task:

Based on the user's input sentence, idea, or theme, automatically determine the most appropriate story style, tone, and genre. Then, write a fully developed, polished, long-form story in natural English.

Requirements:

- Story length: 3,000–5,000 words.

- Automatically choose story style based on user input: it could be contemporary realistic fiction, romance, thriller, sci-fi, fantasy, or any appropriate genre.

- **IMPORTANT: Story settings and character names must be international/Western style. Avoid Chinese, Japanese, Korean, or other Asian settings and names. Use Western locations (e.g., New York, London, Paris, Los Angeles, European cities) and Western character names (e.g., 'Emily', 'Michael', 'Sarah', 'James', 'Emma', 'David').**

- Use character names that are natural and believable for an international/Western audience.

- Include:

  - Detailed daily life scenes and realistic environments (Western/international settings only).

  - Rich sensory descriptions (sights, sounds, smells, textures).

  - Deep exploration of characters' emotions, inner thoughts, and motivations.

  - Complex interpersonal relationships (family, friends, colleagues, romantic interests).

  - Subtle social or cultural context relevant to Western/international settings.

- Narrative must have a clear arc: beginning, development, climax, resolution.

- Use "show, don't tell": convey emotions and tension through actions, dialogue, and inner monologue.

- Maintain continuous narrative flow; no lists, headings, or meta commentary.

- Ensure the story is relatable, emotionally engaging, and reflective of personal growth, life balance, or societal themes.

- Output ONLY the story text in English.

**LANGUAGE REQUIREMENT**: The entire story must be written in English. Do not include any Chinese characters, translations, or non-English text in the output.

Example user input: "A woman struggling to balance career, family, and personal dreams in a bustling city."

The output should be a long, immersive story, automatically choosing a fitting tone, Western/international setting, and realistic Western character names like 'Emily', 'Michael', etc.`;

    const userPrompt = `User input: "${prompt.trim()}"

Please write a fully developed, polished, long-form story (3,000–5,000 words) based on the above input. Automatically determine the most appropriate story style, tone, and genre. **IMPORTANT: Use Western/international settings and Western character names only. Avoid Asian settings and names.** Use natural and believable Western character names (e.g., Emily, Michael, Sarah, James). Include detailed daily life scenes in Western/international settings, rich sensory descriptions, deep exploration of characters' emotions and motivations, and complex interpersonal relationships. The narrative must have a clear arc with beginning, development, climax, and resolution. Use "show, don't tell" throughout. Output ONLY the story text with no lists, headings, or meta commentary.

**CRITICAL LANGUAGE REQUIREMENT**: The entire story must be written in English only. Do not include any Chinese characters, translations, or non-English text anywhere in the output.`;

    // 构建请求参数（使用 OpenAI 兼容格式）
    const requestBody = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 12000, // 支持长故事生成（3000-5000字）
    };

    // 调用 Laozhang Chat Completions API
    const response = await fetch(
      "https://api.laozhang.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = `HTTP ${response.status} ${response.statusText}`;
      }
      return NextResponse.json(
        {
            error: `Laozhang API error: ${response.status}. ${errorText.substring(0, 200)}`,
        },
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      return NextResponse.json(
        {
          error: "Invalid response from AI service. Please try again.",
        },
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

      // 提取返回内容（Laozhang API 返回格式与 OpenAI 兼容）
    const content = data.choices?.[0]?.message?.content || "";

    if (!content) {
      return NextResponse.json(
        { error: "No content in Laozhang API response" },
        { status: 500 }
      );
    }

    // 提取标题（第一行或前50个字符）
    const lines = content.split('\n');
    let title = lines[0] || "AI Generated Script";
    if (title.length > 50) {
      title = title.substring(0, 50) + "...";
    }
    // 移除标题中的#号
    title = title.replace(/^#+\s*/, '').trim();

    // 返回结果
    const finalResponse = {
      success: true,
      data: {
        title: title,
        content: content,
      },
    };
    return NextResponse.json(finalResponse);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate story content",
      },
      { status: 500 }
    );
  }
}

