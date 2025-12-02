import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LAOZHANG_ENDPOINT = "https://api.laozhang.ai/v1/chat/completions";
const LAOZHANG_API_KEY = process.env.LAOZHANG_API_KEY || process.env.Laozhang_API_KEY;
const LAOZHANG_MODEL = "gpt-4o-mini";

const STORYBOARD_SYSTEM_PROMPT = `You are a senior cinematic storyboard director specialized in AI-generated music videos for Sora.

Task:

Given an audio file with its duration, music features (BPM, beats, loudness, key), and an optional video style description, generate a complete, structured, time-aligned storyboard in JSON format. Each scene should contain exactly one shot. Additionally, generate a concatenated Sora-ready video prompt for each scene based on its visual details, music features, and rhythm.

Requirements:

1. JSON structure:

{

  "title": string,

  "visualStyle": string,

  "transitionPrinciples": string,

  "aspectRatio": "16:9" or "9:16",

  "scenes": [

    {

      "sceneId": number,

      "timeRange": [start, end],

      "scenePurpose": string,

      "environment": string,

      "shots": [

        {

          "shotId": number,

          "timeRange": [start, end],

          "shotType": string,

          "camera": {

            "movement": {"type": string, "direction": string, "speed": string},

            "angle": string,

            "distance": string

          },

          "performance": {

            "action": string,

            "facial": string,

            "body": string

          },

          "emotion": string,

          "subject": {"description": string, "action": string, "emotionalState": string},

          "environmentInteraction": string,

          "lighting": string,

          "colorPalette": string,

          "transitionOut": string,

          "keyElements": string,

          "keyBeats": [number, ...],

          "rhythmSync": string

        }

      ],

      "soraPrompt": string

    }

  ]

}

2. Scene count and duration rules:
   - If audio duration is 30 seconds: generate exactly 2 scenes, each 15 seconds
   - If audio duration is 60 seconds: generate exactly 4 scenes, each 15 seconds
   - Each scene must be exactly 15 seconds
   - Scene timeRange must be consecutive: [0, 15], [15, 30], [30, 45], [45, 60]

3. **CRITICAL: Music Feature Integration:**
   - **BPM & Beats**: Align shot transitions and camera movements with beat timings. High BPM (>120) = faster cuts, dynamic movements. Low BPM (<90) = slower, contemplative shots.
   - **Loudness/Energy**: High energy segments = intense visuals, rapid camera movements, dynamic performances. Low energy = subtle, intimate shots.
   - **Key (Musical Key)**: Major keys = brighter, optimistic visuals. Minor keys = darker, moodier visuals. Use this to inform color palette and emotional tone.
   - **keyBeats**: Include the beat timestamps within each shot's timeRange for precise rhythm synchronization.
   - **rhythmSync**: Describe how the visual rhythm matches the musical rhythm (e.g., "camera cuts on every 4th beat", "subject movement syncs with bass drops").

4. **Camera, Performance, and Emotion Requirements:**
   - **camera**: Must include movement type (static, pan, dolly, crane, etc.), direction, speed, angle (high, low, eye-level), and distance (close-up, medium, wide).
   - **performance**: Must describe character action, facial expression, and body language in detail.
   - **emotion**: Must specify the primary emotional state for each shot, aligned with music mood and key.

5. Generate for each scene a **soraPrompt** string that:

   - Includes camera details (movement, angle, distance), subject performance (action, facial, body), emotion, environment, lighting, color palette, transition, key elements

   - **Synchronizes with music beats**: Mention beat-aligned actions, camera cuts, or visual accents

   - **Reflects energy levels**: High energy = dynamic, fast-paced visuals. Low energy = calm, slow-paced visuals.

   - **Matches musical key mood**: Major = bright/optimistic, Minor = dark/moody

   - Matches the visual style and cinematic narrative

   - Is fully ready to feed into Sora for video generation

6. Include 16:9 or 9:16 framing guidance for Sora.  

7. Output JSON only. No explanations, no markdown, no additional text.

Input variables:

- audioContent: [base64 or URL reference]  

- audioDuration: [number in seconds]  

- videoStyle: [optional string, e.g., "Film Noir, moody, high contrast, black and white"]

- musicFeatures: [optional object with bpm, key, beats array, loudnessCurve, energySegments]

Example for a single scene in the output JSON:

{

  "sceneId": 1,

  "timeRange": [0, 15],

  "scenePurpose": "Opening, establish protagonist with rhythm-matched visuals",

  "environment": "Dark city street, neon reflections",

  "shots": [

    {

      "shotId": 1,

      "timeRange": [0, 15],

      "shotType": "Medium-close",

      "camera": {

        "movement": {"type":"slow-pan","direction":"right","speed":"slow"},

        "angle": "eye-level",

        "distance": "medium-close"

      },

      "performance": {

        "action": "walking in sync with beat, left hand on chest",

        "facial": "intense, focused expression",

        "body": "slight forward lean, rhythmic steps matching BPM"

      },

      "emotion": "moody and intense, driven by minor key",

      "subject": {"description":"A young man with black slicked-back hair, sharp jawline","action":"walking with left hand on chest, faint electronic pulses flashing","emotionalState":"moody and intense"},

      "environmentInteraction":"Rain sliding down glass, neon reflections flickering in rhythm with beats",

      "lighting":"High contrast shadows, wet surfaces gleaming, syncs with energy peaks",

      "colorPalette":"Black and white, reflecting minor key mood",

      "transitionOut":"Fade to next scene on beat",

      "keyElements":"Fingertip tremble, chest pulse explodes into white blaze at beat peaks",

      "keyBeats": [0.0, 0.48, 0.96, 1.44, 1.92],

      "rhythmSync": "Camera pan speed matches BPM, subject steps align with beats, visual accents on every 4th beat"

    }

  ],

  "soraPrompt":"Medium-close slow-pan right shot at eye-level of a young man with black slicked-back hair and sharp jawline walking in sync with 128 BPM rhythm, left hand on chest. Faint electronic pulses flash under his skin, synchronized with beat timings. Rain slides down a dark glass window, neon reflections flicker in rhythm. High contrast shadows, black-and-white palette reflecting minor key mood. Subject's steps and camera pan speed match the musical tempo. Visual accents on every 4th beat. Fade transition on beat. 16:9 cinematic framing."

}`;

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!LAOZHANG_API_KEY) {
      return NextResponse.json(
        { error: "LAOZHANG_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { 
      audioDuration, 
      aspectRatio,
      videoStyle,
      lyrics,
      musicFeatures
    } = body;

    if (!audioDuration || !aspectRatio) {
      return NextResponse.json(
        { error: "audioDuration and aspectRatio are required" },
        { status: 400 }
      );
    }

    // 计算场景数量（每个场景15秒）
    // 30秒 = 2个场景，60秒 = 4个场景
    let actualSceneCount: number;
    if (audioDuration <= 30) {
      actualSceneCount = 2; // 30秒生成2个15秒的场景
    } else if (audioDuration <= 60) {
      actualSceneCount = 4; // 60秒生成4个15秒的场景
    } else {
      // 超过60秒，按每15秒一个场景计算，但最多不超过8个场景
      actualSceneCount = Math.min(8, Math.ceil(audioDuration / 15));
    }
    
    // Build the user prompt with audio and video style information
    let musicFeaturesText = '';
    if (musicFeatures) {
      musicFeaturesText = `
- musicFeatures:
  - BPM: ${musicFeatures.bpm || 'N/A'}
  - Key: ${musicFeatures.key || 'N/A'}
  - Beats: ${musicFeatures.beats ? `${musicFeatures.beats.length} beat points` : 'N/A'}
  - Energy segments: ${musicFeatures.energySegments ? `${musicFeatures.energySegments.length} segments` : 'N/A'}
  
CRITICAL: Use these music features to:
1. Align camera movements and shot transitions with beat timings (keyBeats array)
2. Match visual energy to loudness/energy levels (high energy = dynamic visuals, low energy = subtle visuals)
3. Reflect musical key mood in color palette and emotion (major = bright/optimistic, minor = dark/moody)
4. Synchronize performance actions with rhythm (rhythmSync field)
`;
    }

    const userPrompt = `Generate a cinematic storyboard for a music video.

Input:
- audioDuration: ${audioDuration} seconds
- aspectRatio: ${aspectRatio}
- sceneCount: ${actualSceneCount} scenes (each scene must be exactly 15 seconds)
${videoStyle ? `- videoStyle: ${videoStyle}` : ''}
${lyrics ? `- lyrics: ${lyrics.substring(0, 500)}` : ''}${musicFeaturesText}

IMPORTANT: 
- Generate exactly ${actualSceneCount} scenes, each scene must be exactly 15 seconds. Scene timeRange must be consecutive (e.g., [0, 15], [15, 30], [30, 45], [45, 60]).
- Each shot MUST include: camera (movement, angle, distance), performance (action, facial, body), emotion, keyBeats, and rhythmSync.
- The soraPrompt must explicitly mention rhythm synchronization, beat alignment, and energy-matching visuals.

Generate the complete storyboard JSON following the specified format.`;

    // Call Laozhang API
    const response = await fetch(LAOZHANG_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LAOZHANG_API_KEY}`,
      },
      body: JSON.stringify({
        model: LAOZHANG_MODEL,
        messages: [
          {
            role: "system",
            content: STORYBOARD_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Laozhang API error:", errorText);
      return NextResponse.json(
        { error: `API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const storyboardJson = data.choices?.[0]?.message?.content || "{}";

    // Parse the JSON response
    let storyboard;
    try {
      storyboard = JSON.parse(storyboardJson);
    } catch (parseError) {
      console.error("Failed to parse storyboard JSON:", parseError);
      // Try to extract JSON from the response if it's wrapped in markdown
      const jsonMatch = storyboardJson.match(/```json\s*([\s\S]*?)\s*```/) || 
                       storyboardJson.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          storyboard = JSON.parse(jsonMatch[1]);
        } catch (e) {
          return NextResponse.json(
            { error: "Failed to parse storyboard JSON" },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "Failed to parse storyboard JSON" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      storyboard,
    });
  } catch (error) {
    console.error("Error in generate-storyboard API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

