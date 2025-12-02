import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LAOZHANG_ENDPOINT = "https://api.laozhang.ai/v1/chat/completions";
const LAOZHANG_API_KEY = process.env.LAOZHANG_API_KEY || process.env.Laozhang_API_KEY;
const LAOZHANG_MODEL = "gpt-4o-mini";

/**
 * 为单个音频段生成视频描述词和镜头计划
 */
async function generateVideoPromptForSegment(
  segment: { start: number; end: number; energy: number },
  segmentIndex: number,
  totalSegments: number,
  musicFeatures: {
    bpm?: number;
    key?: string;
    beats?: number[];
    loudnessCurve?: Array<{ time: number; value: number }>;
  },
  videoStyle?: string
): Promise<{
  camera: string;
  performance: string;
  emotion: string;
  prompt: string;
  shotPlan: {
    shotSize: string;
    cameraAngle: string;
    framingRule: string;
    cameraMotion: string;
    shotPurpose: string;
    cutContinuity: string;
  };
}> {
  const segmentDuration = segment.end - segment.start;
  const segmentBeats = musicFeatures.beats?.filter(
    beat => beat >= segment.start && beat < segment.end
  ) || [];
  
  // 计算该段的平均能量
  const segmentLoudness = musicFeatures.loudnessCurve?.filter(
    point => point.time >= segment.start && point.time < segment.end
  ) || [];
  const avgEnergy = segmentLoudness.length > 0
    ? segmentLoudness.reduce((sum, p) => sum + p.value, 0) / segmentLoudness.length
    : segment.energy;

  const systemPrompt = `You are a professional video director for music videos. Generate a complete video description and shot plan for a specific audio segment.

CRITICAL REQUIREMENTS:
1. The "prompt" field MUST be a complete, single sentence that can be directly used for video generation. Do NOT use placeholders, variables, or incomplete structures.
2. The prompt must include ALL elements: camera movement, subject performance, emotion, environment, lighting, and style.
3. The "shotPlan" field must provide detailed technical specifications for lip-sync video generation, including shot size, camera angle, framing rules, camera motion, shot purpose, and cut continuity.
4. Output MUST be valid JSON only, no markdown, no explanations.

Output format (JSON):
{
  "camera": "Camera description (movement type, angle, distance, framing)",
  "performance": "Character performance description (action, facial expression, body language)",
  "emotion": "Emotional state and mood",
  "prompt": "Complete single sentence ready for video generation, including camera, subject, performance, emotion, environment, lighting, and style. MUST incorporate shotPlan details (shotSize, cameraAngle, framingRule, cameraMotion) into the prompt.",
  "shotPlan": {
    "shotSize": "Shot size (e.g., 'tight close-up', 'close-up', 'medium close-up', 'medium shot', 'wide shot')",
    "cameraAngle": "Camera angle (e.g., 'low-angle', 'eye-level', 'high-angle', 'dutch angle')",
    "framingRule": "Framing rule for lip-sync (e.g., 'face centered, mouth fully visible', 'upper body visible, face prominent')",
    "cameraMotion": "Camera motion style (e.g., 'subtle handheld', 'static', 'slow push-in', 'gentle pan')",
    "shotPurpose": "Purpose of this shot (e.g., 'maximize lip-sync readability and emotional impact', 'establish character presence')",
    "cutContinuity": "Continuity with previous/next shots (e.g., 'same shot scale as previous chorus scene', 'transition from wide to close-up')"
  }
}`;

  const userPrompt = `Generate video description for audio segment ${segmentIndex + 1} of ${totalSegments}.

Segment details:
- Time range: ${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s
- Duration: ${segmentDuration.toFixed(2)} seconds
- Energy level: ${avgEnergy.toFixed(3)} (0.0 = low, 1.0 = high)
- BPM: ${musicFeatures.bpm || 'N/A'}
- Musical key: ${musicFeatures.key || 'N/A'}
- Beats in segment: ${segmentBeats.length} beats
${videoStyle ? `- Video style: ${videoStyle}` : ''}

Energy analysis:
- ${avgEnergy > 0.7 ? 'HIGH ENERGY' : avgEnergy > 0.4 ? 'MEDIUM ENERGY' : 'LOW ENERGY'} segment
- ${avgEnergy > 0.7 ? 'Dynamic, fast-paced visuals with rapid camera movements and intense performances' : avgEnergy > 0.4 ? 'Moderate pacing with balanced camera work and natural performances' : 'Calm, contemplative visuals with slow camera movements and subtle performances'}

Musical context:
- ${musicFeatures.key?.includes('minor') ? 'Minor key suggests darker, moodier visuals' : musicFeatures.key?.includes('major') ? 'Major key suggests brighter, optimistic visuals' : 'Use musical key to inform color palette and emotional tone'}
- ${musicFeatures.bpm && musicFeatures.bpm > 120 ? 'High BPM requires faster cuts and dynamic movements' : musicFeatures.bpm && musicFeatures.bpm < 90 ? 'Low BPM allows for slower, contemplative shots' : 'Match camera movement speed to BPM'}

Generate a complete video description with:
1. Camera: Specific camera movement (pan, dolly, static, etc.), angle (high, low, eye-level), distance (close-up, medium, wide), and framing
2. Performance: Detailed character action, facial expression, and body language
3. Emotion: Primary emotional state aligned with music mood
4. ShotPlan: Technical specifications for lip-sync video generation:
   - shotSize: Choose appropriate shot size (tight close-up for intimate moments, close-up for lip-sync focus, medium close-up for balanced view, medium shot for context, wide shot for establishing)
   - cameraAngle: Choose angle that enhances emotion and lip-sync visibility (low-angle for power, eye-level for connection, high-angle for vulnerability)
   - framingRule: Ensure face and mouth are clearly visible for lip-sync (e.g., "face centered, mouth fully visible", "upper body visible, face prominent")
   - cameraMotion: Choose motion that supports performance without distracting (subtle handheld for energy, static for focus, slow push-in for intimacy)
   - shotPurpose: Define the purpose, especially for lip-sync readability (e.g., "maximize lip-sync readability and emotional impact")
   - cutContinuity: Describe how this shot relates to previous/next shots (e.g., "same shot scale as previous chorus scene", "transition from wide to close-up")
5. Prompt: A complete, single sentence that combines all elements INCLUDING shotPlan details (shotSize, cameraAngle, framingRule, cameraMotion) and is ready for video generation. Must be a full sentence, not a template or structure.

Example of good prompt with shotPlan integration:
"A tight close-up shot at low-angle with face centered and mouth fully visible, using subtle handheld motion, captures a young performer's intense expression, moving in sync with the 128 BPM rhythm, with high contrast shadows and black-and-white palette reflecting the minor key mood, maximizing lip-sync readability and emotional impact."

Generate the JSON now.`;

  try {
    const response = await fetch(LAOZHANG_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LAOZHANG_API_KEY}`,
      },
      body: JSON.stringify({
        model: LAOZHANG_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Laozhang API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      // 尝试提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse JSON response");
      }
    }

    // 验证必需字段
    if (!parsed.camera || !parsed.performance || !parsed.emotion || !parsed.prompt || !parsed.shotPlan) {
      throw new Error("Missing required fields in response");
    }

    // 验证shotPlan字段
    if (!parsed.shotPlan.shotSize || !parsed.shotPlan.cameraAngle || !parsed.shotPlan.framingRule || 
        !parsed.shotPlan.cameraMotion || !parsed.shotPlan.shotPurpose || !parsed.shotPlan.cutContinuity) {
      throw new Error("Missing required shotPlan fields in response");
    }

    // 确保prompt是完整的一句话
    if (parsed.prompt.trim().length < 20 || !parsed.prompt.includes('.')) {
      throw new Error("Prompt is not a complete sentence");
    }

    return {
      camera: parsed.camera,
      performance: parsed.performance,
      emotion: parsed.emotion,
      prompt: parsed.prompt.trim(),
      shotPlan: {
        shotSize: parsed.shotPlan.shotSize,
        cameraAngle: parsed.shotPlan.cameraAngle,
        framingRule: parsed.shotPlan.framingRule,
        cameraMotion: parsed.shotPlan.cameraMotion,
        shotPurpose: parsed.shotPlan.shotPurpose,
        cutContinuity: parsed.shotPlan.cutContinuity,
      },
    };
  } catch (error) {
    console.error(`Error generating video prompt for segment ${segmentIndex + 1}:`, error);
    // 返回默认值
    return {
      camera: `Medium shot with slow camera movement`,
      performance: `Character performing with ${avgEnergy > 0.7 ? 'dynamic' : 'subtle'} movements`,
      emotion: `${musicFeatures.key?.includes('minor') ? 'moody' : 'bright'} and ${avgEnergy > 0.7 ? 'intense' : 'calm'}`,
      prompt: `A medium shot with slow camera movement captures a character performing with ${avgEnergy > 0.7 ? 'dynamic' : 'subtle'} movements, expressing a ${musicFeatures.key?.includes('minor') ? 'moody' : 'bright'} and ${avgEnergy > 0.7 ? 'intense' : 'calm'} emotion, in a cinematic environment with appropriate lighting and style.`,
      shotPlan: {
        shotSize: 'medium close-up',
        cameraAngle: 'eye-level',
        framingRule: 'face centered, mouth fully visible',
        cameraMotion: 'subtle handheld',
        shotPurpose: 'maximize lip-sync readability and emotional impact',
        cutContinuity: 'maintain consistent shot scale',
      },
    };
  }
}

/**
 * POST /api/music/analyze-audio
 * 使用 Essentia 分析音频特征（BPM、拍点、Loudness、Key）
 * 并为每个音频段生成视频描述词
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { audioUrl, startTime = 0, endTime, videoStyle } = body;

    if (!audioUrl) {
      return NextResponse.json(
        { error: "audioUrl is required" },
        { status: 400 }
      );
    }

    // TODO: 实际实现需要调用 Essentia 服务
    // 这里提供一个 mock 实现，返回模拟的音频特征数据
    const duration = endTime ? endTime - startTime : 30;
    
    // 模拟 BPM（通常在 60-180 之间）
    const bpm = Math.floor(Math.random() * 120) + 60;
    
    // 根据 BPM 生成拍点时间数组
    const beatInterval = 60 / bpm;
    const beats: number[] = [];
    for (let time = startTime; time < (endTime || startTime + duration); time += beatInterval) {
      beats.push(parseFloat(time.toFixed(2)));
    }

    // 模拟 Loudness 曲线（每0.5秒一个数据点）
    const loudnessCurve: Array<{ time: number; value: number }> = [];
    for (let t = startTime; t < (endTime || startTime + duration); t += 0.5) {
      // 模拟能量变化（正弦波 + 随机噪声）
      const normalizedTime = (t - startTime) / duration;
      const baseEnergy = 0.5 + 0.3 * Math.sin(normalizedTime * Math.PI * 2);
      const noise = (Math.random() - 0.5) * 0.2;
      loudnessCurve.push({
        time: parseFloat(t.toFixed(2)),
        value: Math.max(0, Math.min(1, baseEnergy + noise))
      });
    }

    // 模拟 Key（调式）
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const modes = ['major', 'minor'];
    const key = keys[Math.floor(Math.random() * keys.length)];
    const mode = modes[Math.floor(Math.random() * modes.length)];

    // 计算能量分段（用于自动拆段）
    const energySegments: Array<{ start: number; end: number; energy: number }> = [];
    const segmentDuration = 5; // 每5秒一个分段
    for (let segStart = startTime; segStart < (endTime || startTime + duration); segStart += segmentDuration) {
      const segEnd = Math.min(segStart + segmentDuration, endTime || startTime + duration);
      // 计算该段的平均能量
      const segmentLoudness = loudnessCurve.filter(
        point => point.time >= segStart && point.time < segEnd
      );
      const avgEnergy = segmentLoudness.length > 0
        ? segmentLoudness.reduce((sum, p) => sum + p.value, 0) / segmentLoudness.length
        : 0.5;
      
      energySegments.push({
        start: parseFloat(segStart.toFixed(2)),
        end: parseFloat(segEnd.toFixed(2)),
        energy: parseFloat(avgEnergy.toFixed(3))
      });
    }

    // 为每个音频段生成视频描述词
    const musicFeatures = {
      bpm,
      key: `${key} ${mode}`,
      beats,
      loudnessCurve,
    };

    console.log(`[analyze-audio] 开始为 ${energySegments.length} 个音频段生成视频描述词...`);
    
    const segmentsWithPrompts = await Promise.all(
      energySegments.map(async (segment, index) => {
        const videoPrompt = await generateVideoPromptForSegment(
          segment,
          index,
          energySegments.length,
          musicFeatures,
          videoStyle
        );
        
        return {
          ...segment,
          videoPrompt,
        };
      })
    );

    console.log(`[analyze-audio] 完成所有音频段的视频描述词生成`);

    return NextResponse.json({
      success: true,
      data: {
        bpm,
        key: `${key} ${mode}`,
        beats,
        loudnessCurve,
        energySegments: segmentsWithPrompts,
        duration: parseFloat(duration.toFixed(2)),
      },
    });
  } catch (error) {
    console.error("Error in analyze-audio API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

