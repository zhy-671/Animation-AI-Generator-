import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";

interface AudioSetting {
  sample_rate?: number;
  bitrate?: number;
  format?: string;
}

const DEFAULT_AUDIO_SETTING: Required<AudioSetting> = {
  sample_rate: 44100,
  bitrate: 256000,
  format: "mp3",
};

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.MINIMAXI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "MINIMAXI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      prompt,
      lyrics,
      audioSetting,
    }: {
      prompt?: string;
      lyrics?: string;
      audioSetting?: AudioSetting;
    } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    // lyrics 可以为空字符串（当instrumental为true时）
    if (lyrics === undefined || lyrics === null || typeof lyrics !== "string") {
      return NextResponse.json(
        { error: "lyrics field is required (can be empty string for instrumental mode)" },
        { status: 400 }
      );
    }

    const resolvedAudioSetting: Required<AudioSetting> = {
      ...DEFAULT_AUDIO_SETTING,
      ...audioSetting,
    };

    // 构建请求参数
    const requestBody = {
      model: "music-2.0",
      prompt: prompt.trim(),
      lyrics,
      audio_setting: resolvedAudioSetting,
    };

    // 打印 MiniMax API 请求参数
    console.log("========== MiniMax API 请求参数 ==========");
    console.log("API URL:", "https://api.minimaxi.com/v1/music_generation");
    console.log("Request Body:", {
      model: requestBody.model,
      prompt: requestBody.prompt,
      promptLength: requestBody.prompt.length,
      lyrics: requestBody.lyrics,
      lyricsLength: requestBody.lyrics.length,
      audio_setting: requestBody.audio_setting,
    });
    console.log("==========================================");

    const response = await fetch("https://api.minimaxi.com/v1/music_generation", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("========== MiniMax API 错误响应 ==========");
      console.error("Status:", response.status);
      console.error("Error Text:", errorText);
      console.error("==========================================");
      throw new Error(`MiniMaxi API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // 打印 MiniMax API 返回结果
    console.log("========== MiniMax API 返回结果 ==========");
    console.log("Response Status:", response.status);
    console.log("Full Response Data:", JSON.stringify(data, null, 2));
    console.log("Base Response:", data?.base_resp);
    console.log("Data Status:", data?.data?.status);
    console.log("Audio Hex Length:", data?.data?.audio?.length || 0);
    console.log("Trace ID:", data?.trace_id);
    console.log("Extra Info:", data?.extra_info);
    console.log("==========================================");

    const statusCode = data?.base_resp?.status_code;
    if (statusCode !== 0) {
      console.error("MiniMax API 返回错误状态码:", statusCode);
      console.error("错误信息:", data?.base_resp?.status_msg);
      throw new Error(data?.base_resp?.status_msg || "MiniMaxi API returned an error");
    }

    const apiStatus = data?.data?.status;
    const audioHex: string | undefined = data?.data?.audio;

    if (apiStatus !== 2 || !audioHex) {
      console.error("MiniMax API 音频数据未就绪:");
      console.error("API Status:", apiStatus);
      console.error("Has Audio Hex:", !!audioHex);
      throw new Error("MiniMaxi API did not return ready audio data");
    }

    const audioBuffer = Buffer.from(audioHex, "hex");
    const audioBase64 = audioBuffer.toString("base64");

    return NextResponse.json({
      success: true,
      audioBase64,
      format: resolvedAudioSetting.format,
      status: apiStatus,
      traceId: data?.trace_id,
      extraInfo: data?.extra_info,
      baseResp: data?.base_resp,
    });
  } catch (error) {
    console.error("Error generating music via MiniMaxi:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate music audio",
      },
      { status: 500 }
    );
  }
}


