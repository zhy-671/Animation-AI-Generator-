import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/music/generate-prompt
 * 调用老张API生成音乐提示词
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
    const { 
      genre,
      mood,
      theme,
      tempo,
      energy,
      description
    } = body;

    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json(
        { error: "description is required" },
        { status: 400 }
      );
    }

    const resolvedGenre = genre || "pop";
    const resolvedMood = mood || "energetic";
    const resolvedTheme = theme || "summer";
    const resolvedTempo = tempo || "moderate";
    const resolvedEnergy = energy || "medium";

    const systemPrompt = `You are a professional music AI assistant.

User has provided the following song attributes:

Genre: ${resolvedGenre}

Mood: ${resolvedMood}

Theme: ${resolvedTheme}

Tempo: ${resolvedTempo}

Energy: ${resolvedEnergy}

Description: "${description}"

Constraints:

1. Generate a **music title** (field "title") that fits the genre, mood, theme, tempo, and energy of the song.

2. Generate a **prompt** within 10 - 300 characters:

   - Concise description of the music style and sound

   - Mood and emotional tone

   - Scene or theme

   - Instruments, beats, and production elements

   - Optional vocal or FX characteristics

3. Generate **lyrics** within 10 - 3000 characters:

   - Use structure tags:

       [Intro], [Verse], [Chorus], [Bridge], [Outro]

   - Each line separated by newline (\\n)

   - Must be singable and fit the chosen genre, mood, theme, tempo, energy, and description

4. Generate an **image** field (50 - 300 characters) for AI cover art generation:

   - Should visually match the song's genre, mood, and theme

   - Describe colors, style, atmosphere, and main visual concept

   - No human faces unless user description requires

   - Should be suitable as a music cover

Output:

Return the result in **JSON format** exactly like this:

{
  "title": "Generated music title",
  "genre": "${resolvedGenre}",
  "mood": "${resolvedMood}",
  "theme": "${resolvedTheme}",
  "tempo": "${resolvedTempo}",
  "energy": "${resolvedEnergy}",
  "description": "${description}",
  "prompt": "Concatenated music prompt within 10-300 characters",
  "lyrics": "Generated lyrics within 10-3000 characters with structure tags",
  "image": "Cover art prompt within 50-300 characters"
}

`;

    const userContent = `${description}`;

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
            content: systemPrompt
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
    console.log("Laozhang generate-prompt response:", data);

    const aiContent = data.choices?.[0]?.message?.content?.trim() || "";
    let parsedContent: {
      prompt?: string;
      lyrics?: string;
      image?: string;
      title?: string;
    } | null = null;

    if (aiContent) {
      try {
        parsedContent = JSON.parse(aiContent);
      } catch (parseError) {
        console.warn("Failed to parse AI response as JSON, using raw content.", parseError);
      }
    }

    const generatedPrompt = parsedContent?.prompt || aiContent;
    const generatedLyrics = parsedContent?.lyrics || "";
    const generatedImage = parsedContent?.image || "";
    const generatedTitle = parsedContent?.title || "";

    if (!generatedPrompt) {
      throw new Error("Failed to generate prompt from API response");
    }

    return NextResponse.json({
      success: true,
      prompt: generatedPrompt.trim(),
      lyrics: generatedLyrics,
      image: generatedImage,
      title: generatedTitle,
      raw: aiContent
    });
  } catch (error) {
    console.error("Error generating music prompt:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate music prompt",
      },
      { status: 500 }
    );
  }
}

