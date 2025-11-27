import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/music/generate-title-and-image
 * 调用老张API从歌词生成歌曲标题和图片描述
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.LAOZHANG_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "LAOZHANG_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { lyrics } = body;

    if (!lyrics || typeof lyrics !== "string" || !lyrics.trim()) {
      return NextResponse.json(
        { error: "lyrics is required" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a professional music AI assistant.

User has provided the following song lyrics:

"{lyrics}"

Tasks:

1. Generate a **song title** that:

   - Captures the theme, mood, and emotions expressed in the lyrics

   - Is concise, memorable, and suitable as a music title

2. Generate an **image prompt** for AI cover art that:

   - Visually represents the song's theme, mood, and emotions

   - Includes colors, style, atmosphere, and key visual elements

   - Is suitable as an album or single cover art

   - Length between 50-300 characters

Output format in JSON:

{
  "title": "Generated song title",
  "image": "Generated cover art description"
}`;

    const userContent = lyrics.trim();
    const systemPromptWithLyrics = systemPrompt.replace("{lyrics}", userContent);

    // 调用老张API
    const response = await fetch("https://api.laozhang.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPromptWithLyrics
          },
          {
            role: "user",
            content: userContent
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Laozhang API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Laozhang generate-title-and-image response:", data);

    const aiContent = data.choices?.[0]?.message?.content?.trim() || "";
    let parsedContent: {
      title?: string;
      image?: string;
    } | null = null;

    if (aiContent) {
      try {
        parsedContent = JSON.parse(aiContent);
      } catch (parseError) {
        console.warn("Failed to parse AI response as JSON, using raw content.", parseError);
      }
    }

    const generatedTitle = parsedContent?.title || "";
    const generatedImage = parsedContent?.image || "";

    if (!generatedTitle) {
      throw new Error("Failed to generate title from API response");
    }

    if (!generatedImage) {
      throw new Error("Failed to generate image prompt from API response");
    }

    return NextResponse.json({
      success: true,
      title: generatedTitle.trim(),
      image: generatedImage.trim(),
      raw: aiContent
    });
  } catch (error) {
    console.error("Error generating title and image:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate title and image",
      },
      { status: 500 }
    );
  }
}

