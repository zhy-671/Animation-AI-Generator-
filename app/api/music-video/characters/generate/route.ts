import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

interface CharacterConfig {
  gender: "male" | "female";
  roleLabel: string;
}

interface AiCharacterPayload {
  name?: string;
  role?: string;
  age?: string | number;
  gender?: string;
  description?: string;
  personality?: string;
  background?: string;
  appearance?: Record<string, string> | string;
  clothing?: Record<string, string> | string;
  image_prompt?: string;
}

interface CharacterDetailPayload {
  id: string;
  name: string;
  role: string;
  age: string;
  gender: string;
  description?: string;
  appearance: {
    hair_color: string;
    eye_color: string;
    hair_style: string;
    height: string;
    build: string;
    skin_tone: string;
    facial_features: string;
    distinct_marks: string;
  };
  clothing: {
    style: string;
    accessories: string;
    footwear: string;
  };
  personality: string;
  background: string;
  skills_abilities: string[];
  relationships: string[];
  visual_reference_prompt: string;
  pose_references: string[];
  imageUrl: string | null;
  imageGenerationPrompt: string;
}

const CHARACTER_BLUEPRINTS: Record<
  "male" | "female" | "duet" | "default",
  CharacterConfig[]
> = {
  male: [{ gender: "male", roleLabel: "Lead male vocalist" }],
  female: [{ gender: "female", roleLabel: "Lead female vocalist" }],
  duet: [
    { gender: "female", roleLabel: "Lead female vocalist" },
    { gender: "male", roleLabel: "Lead male vocalist" },
  ],
  default: [{ gender: "female", roleLabel: "Visual storyteller" }],
};

const MAX_LYRICS_LENGTH = 3200;
const LAOZHANG_ENDPOINT = "https://api.laozhang.ai/v1/chat/completions";

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

const normalizeAppearance = (appearance: Record<string, string> | string | undefined) => {
  if (!appearance) {
    return {
      hair_color: "",
      eye_color: "",
      hair_style: "",
      height: "",
      build: "",
      skin_tone: "",
      facial_features: "",
      distinct_marks: "",
    };
  }

  if (typeof appearance === "string") {
    return {
      hair_color: "",
      eye_color: "",
      hair_style: "",
      height: "",
      build: "",
      skin_tone: "",
      facial_features: appearance,
      distinct_marks: "",
    };
  }

  return {
    hair_color: appearance.hair_color || "",
    eye_color: appearance.eye_color || "",
    hair_style: appearance.hair_style || "",
    height: appearance.height || "",
    build: appearance.build || "",
    skin_tone: appearance.skin_tone || "",
    facial_features: appearance.facial_features || "",
    distinct_marks: appearance.distinct_marks || "",
  };
};

const normalizeClothing = (clothing: Record<string, string> | string | undefined) => {
  if (!clothing) {
    return {
      style: "",
      accessories: "",
      footwear: "",
    };
  }

  if (typeof clothing === "string") {
    return {
      style: clothing,
      accessories: "",
      footwear: "",
    };
  }

  return {
    style: clothing.style || "",
    accessories: clothing.accessories || "",
    footwear: clothing.footwear || "",
  };
};

const parseMetadata = (metadata: unknown) => {
  if (!metadata) return {};
  if (typeof metadata === "object") return metadata as Record<string, unknown>;
  if (typeof metadata === "string") {
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  }
  return {};
};

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.LAOZHANG_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "LAOZHANG_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { musicId, force } = body as { musicId?: string; force?: boolean };

    if (!musicId) {
      return NextResponse.json(
        { error: "musicId is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: music, error: musicError } = await supabase
      .from("anim_music")
      .select("id, title, prompt, metadata, voice_type, instrumental, user_id")
      .eq("id", musicId)
      .eq("user_id", user.id)
      .single();

    if (musicError || !music) {
      return NextResponse.json(
        { error: "Music not found or access denied" },
        { status: 404 }
      );
    }

    if (!force) {
      const { data: existing } = await supabase
        .from("music_video_characters")
        .select("id")
        .eq("music_id", musicId)
        .eq("user_id", user.id);

      if (existing && existing.length > 0) {
        return NextResponse.json({
          success: true,
          alreadyExists: true,
          count: existing.length,
        });
      }
    }

    const metadata = parseMetadata(music.metadata);
    const lyricsRaw =
      typeof metadata?.lyrics === "string" ? metadata.lyrics : "";
    const lyricsExcerpt = lyricsRaw
      ? lyricsRaw.slice(0, MAX_LYRICS_LENGTH)
      : "";

    const resolvedVoiceType = (music.voice_type as
      | "male"
      | "female"
      | "duet"
      | null) ?? (music.instrumental ? null : "female");

    const blueprintKey: "male" | "female" | "duet" | "default" =
      resolvedVoiceType && ["male", "female", "duet"].includes(resolvedVoiceType)
        ? (resolvedVoiceType as "male" | "female" | "duet")
        : "default";

    const characterBlueprints = CHARACTER_BLUEPRINTS[blueprintKey];

    const systemPrompt = `You are an award-winning music video creative director.
Generate cinematic character biographies that match the provided lyrics and vocal arrangement.
Always respond in valid JSON that follows this schema:
{
  "characters": [
    {
      "name": "Unique stage-ready name",
      "role": "Short role label",
      "age": "Number or range as a string",
      "gender": "male | female | non-binary",
      "description": "One sentence hook for the character",
      "appearance": {
        "hair_color": "...",
        "eye_color": "...",
        "hair_style": "...",
        "height": "...",
        "build": "...",
        "skin_tone": "...",
        "facial_features": "...",
        "distinct_marks": "..."
      },
      "clothing": {
        "style": "...",
        "accessories": "...",
        "footwear": "..."
      },
      "personality": "Key personality notes",
      "background": "One or two sentences of backstory",
      "image_prompt": "Detailed English prompt for a portrait illustration"
    }
  ]
}

Rules:
- Number of characters MUST equal the provided character_count.
- Use English only.
- Make every field descriptive yet concise.
- image_prompt should be under 70 words and avoid camera jargon.`;

    const vocalSummary = characterBlueprints
      .map(
        (blueprint, index) =>
          `Character ${index + 1}: ${blueprint.roleLabel} (${blueprint.gender}).`
      )
      .join(" ");

    const songTitle = music.title || "Untitled Track";
    const musicalConcept = music.prompt || "No additional prompt provided.";

    const lyricsSection = lyricsExcerpt
      ? `Lyric excerpt (trimmed to ${MAX_LYRICS_LENGTH} chars):
${lyricsExcerpt}`
      : `No lyrics provided. Use the music concept to inspire the characters.`;

    const userPrompt = `Song title: ${songTitle}

Vocal configuration:
${vocalSummary}

Character count: ${characterBlueprints.length}

Music concept:
${musicalConcept}

${lyricsSection}

Design distinct performer personas that can star in a stylized music video.`;

    const response = await fetch(LAOZHANG_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.8,
        max_tokens: 1800,
        messages: [
          { role: "system", content: systemPrompt },
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

    const completion = await response.json();
    const aiContent =
      completion?.choices?.[0]?.message?.content?.trim() || "";

    if (!aiContent) {
      throw new Error("Empty response from LaoZhang API");
    }

    const parsed = extractJsonFromContent(aiContent);
    const characters = Array.isArray(parsed?.characters)
      ? (parsed.characters as AiCharacterPayload[])
      : [];

    if (characters.length !== characterBlueprints.length) {
      throw new Error("Character count mismatch in AI response");
    }

    const detailPayloads: CharacterDetailPayload[] = characters.map(
      (character, index) => {
        const blueprint = characterBlueprints[index];
        const generatedId = randomUUID();
        const safeName =
          character.name?.trim() ||
          `${blueprint.gender === "male" ? "Arion" : "Lyra"} ${generatedId.slice(
            0,
            4
          )}`;
        const safeRole = character.role?.trim() || blueprint.roleLabel;
        const safeGender =
          character.gender?.toLowerCase().replace(/[^a-z-]/g, "") ||
          blueprint.gender;

        const appearance = normalizeAppearance(
          character.appearance as Record<string, string> | string | undefined
        );
        const clothing = normalizeClothing(
          character.clothing as Record<string, string> | string | undefined
        );

        return {
          id: generatedId,
          name: safeName,
          role: safeRole,
          age:
            character.age !== undefined
              ? String(character.age)
              : "22",
          gender: safeGender,
          description: character.description || "",
          appearance,
          clothing,
          personality: character.personality || "",
          background: character.background || "",
          skills_abilities: [],
          relationships: [],
          visual_reference_prompt: character.image_prompt || "",
          pose_references: [],
          imageUrl: null,
          imageGenerationPrompt: character.image_prompt || "",
        };
      }
    );

    const insertPayload = detailPayloads.map((detail) => ({
      id: detail.id,
      music_id: musicId,
      user_id: user.id,
      name: detail.name,
      description: detail.role || detail.description || detail.personality,
      image_url: null,
      character_data: detail,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("music_video_characters")
      .insert(insertPayload)
      .select("*");

    if (insertError) {
      throw new Error(`Failed to save generated characters: ${insertError.message}`);
    }

    return NextResponse.json({
      success: true,
      characters: inserted,
    });
  } catch (error) {
    console.error("Character generation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate music video characters",
      },
      { status: 500 }
    );
  }
}


