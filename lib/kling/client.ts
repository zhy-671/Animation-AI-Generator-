/**
 * 可灵AI API客户端
 * API域名: https://api-beijing.klingai.com
 */

import * as jwt from "jsonwebtoken";

const KLING_API_BASE = "https://api-beijing.klingai.com";

// 从环境变量获取API密钥
const KLING_ACCESS_KEY = process.env.KLING_ACCESS_KEY || "";
const KLING_SECRET_KEY = process.env.KLING_SECRET_KEY || "";

// 简单的内存缓存：在 token 未过期期间复用同一个 JWT，减少签名次数
let cachedToken: string | null = null;
let cachedTokenExp: number | null = null; // 秒级时间戳

/**
 * 生成JWT Token用于API鉴权
 */
function generateJWTToken(): string {
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    throw new Error("KLING_ACCESS_KEY and KLING_SECRET_KEY must be set");
  }

  const now = Math.floor(Date.now() / 1000);
  // 如果有缓存并且还在有效期内（预留 5 秒安全窗口），则直接复用
  if (cachedToken && cachedTokenExp && now < cachedTokenExp - 5) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Kling] JWT cache hit", { exp: cachedTokenExp, now });
    }
    return cachedToken;
  }

  const headers = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload = {
    iss: KLING_ACCESS_KEY,
    exp: now + 1800, // 30分钟有效期
    nbf: now - 5, // 提前5秒生效
  };

  const token = jwt.sign(payload, KLING_SECRET_KEY, { header: headers });

  // 写入缓存
  cachedToken = token;
  cachedTokenExp = payload.exp;

  // 调试：仅在开发环境打印 JWT 的 header / payload 信息，不打印 token 本身
  if (process.env.NODE_ENV === "development") {
    const maskedAk =
      KLING_ACCESS_KEY.length > 6
        ? `${KLING_ACCESS_KEY.slice(0, 3)}***${KLING_ACCESS_KEY.slice(-3)}`
        : "***";
    console.log("[Kling] JWT debug", {
      ak: maskedAk,
      header: headers,
      payload,
    });
  }

  return token;
}

/**
 * 获取Authorization Header
 */
function getAuthHeader(): string {
  const token = generateJWTToken();
  const auth = `Bearer ${token}`;

  // 调试：仅在开发环境打印 Authorization 的前缀，避免泄露完整 token
  if (process.env.NODE_ENV === "development") {
    console.log("[Kling] Authorization debug", {
      authorizationPreview: auth,
    });
  }

  return auth;
}

/**
 * 人脸识别接口
 */
export interface IdentifyFaceRequest {
  video_id?: string; // 视频ID（与video_url二选一）
  video_url?: string; // 视频URL（与video_id二选一）
}

export interface FaceData {
  face_id: string; // 人脸ID
  face_image: string; // 人脸示意图URL
  start_time: number; // 可对口型区间起点时间（毫秒）
  end_time: number; // 可对口型区间终点时间（毫秒）
}

export interface IdentifyFaceResponse {
  code: number;
  message: string;
  request_id: string;
  data: {
    session_id: string; // 会话ID，有效期24小时
    face_data: FaceData[];
  };
}

export async function identifyFace(
  request: IdentifyFaceRequest
): Promise<IdentifyFaceResponse> {
  const response = await fetch(`${KLING_API_BASE}/v1/videos/identify-face`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(request),
  });

  const data = await response.json();
  
  if (data.code !== 0) {
    throw new Error(`Kling API error: ${data.code} - ${data.message}`);
  }

  return data;
}

/**
 * 创建对口型任务
 */
export interface LipSyncRequest {
  session_id: string; // 会话ID
  face_choose: Array<{
    face_id: string; // 人脸ID
    audio_id?: string; // 音频ID（与sound_file二选一）
    sound_file?: string; // 音频文件Base64或URL（与audio_id二选一）
    sound_start_time: number; // 音频裁剪起点时间（毫秒）
    sound_end_time: number; // 音频裁剪终点时间（毫秒）
    sound_insert_time: number; // 裁剪后音频插入时间（毫秒）
    sound_volume?: number; // 音频音量，默认1，范围[0, 2]
    original_audio_volume?: number; // 原始视频音量，默认1，范围[0, 2]
  }>;
  external_task_id?: string; // 自定义任务ID
  callback_url?: string; // 回调地址
}

export interface LipSyncResponse {
  code: number;
  message: string;
  request_id: string;
  data: {
    task_id: string; // 任务ID
    task_info: {
      external_task_id?: string;
    };
    task_status: "submitted" | "processing" | "succeed" | "failed";
    created_at: number; // Unix时间戳（毫秒）
    updated_at: number; // Unix时间戳（毫秒）
  };
}

export async function createLipSyncTask(
  request: LipSyncRequest
): Promise<LipSyncResponse> {
  const response = await fetch(
    `${KLING_API_BASE}/v1/videos/advanced-lip-sync`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify(request),
    }
  );

  const data = await response.json();
  
  if (data.code !== 0) {
    throw new Error(`Kling API error: ${data.code} - ${data.message}`);
  }

  return data;
}

/**
 * 查询对口型任务状态
 */
export interface LipSyncTaskStatus {
  code: number;
  message: string;
  request_id: string;
  data: {
    task_id: string;
    task_status: "submitted" | "processing" | "succeed" | "failed";
    task_status_msg?: string; // 任务状态信息，失败时展示失败原因
    task_info: {
      parent_video: {
        id: string;
        url: string;
        duration: string; // 单位秒
      };
    };
    task_result?: {
      videos: Array<{
        id: string;
        url: string; // 对口型视频URL（30天后清理）
        duration: string; // 单位秒
      }>;
    };
    created_at: number;
    updated_at: number;
  };
}

export async function getLipSyncTaskStatus(
  taskId: string
): Promise<LipSyncTaskStatus> {
  const response = await fetch(
    `${KLING_API_BASE}/v1/videos/advanced-lip-sync/${taskId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: getAuthHeader(),
      },
    }
  );

  const data = await response.json();
  
  if (data.code !== 0) {
    throw new Error(`Kling API error: ${data.code} - ${data.message}`);
  }

  return data;
}

