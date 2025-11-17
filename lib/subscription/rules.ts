/**
 * 订阅计划规则配置
 */

export type SubscriptionPlan = 'basic' | 'pro' | 'studio' | null;

export interface SubscriptionPlanConfig {
  name: string;
  videoResolutions: ('480p' | '720p' | '1080p')[];
  creditsPerSecond: {
    '480p': number;
    '720p': number;
    '1080p': number;
  };
  maxImagesPerMonth: number;
  maxStoryboardsPerMonth: number;
  maxVoiceoverSecondsPerMonth: number;
  maxDownloadsPerDay: number | null; // null表示无限制
  allowsStoryboard: boolean;
  allowsCommercialLicense: boolean;
  allowedAnimationStyles: string[]; // 允许的动画风格
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, SubscriptionPlanConfig> = {
  basic: {
    name: 'Basic',
    videoResolutions: ['480p', '720p'],
    creditsPerSecond: {
      '480p': 4,
      '720p': 4,
      '1080p': 0, // 不支持
    },
    maxImagesPerMonth: 50,
    maxStoryboardsPerMonth: 20,
    maxVoiceoverSecondsPerMonth: 60,
    maxDownloadsPerDay: 3,
    allowsStoryboard: false, // Basic计划不支持分镜
    allowsCommercialLicense: false,
    allowedAnimationStyles: ['2d', '3d', 'anime'], // 只允许前3个
  },
  pro: {
    name: 'Pro',
    videoResolutions: ['480p', '720p'],
    creditsPerSecond: {
      '480p': 5,
      '720p': 5,
      '1080p': 0, // 不支持
    },
    maxImagesPerMonth: 200,
    maxStoryboardsPerMonth: 100,
    maxVoiceoverSecondsPerMonth: 300,
    maxDownloadsPerDay: 10,
    allowsStoryboard: true,
    allowsCommercialLicense: true,
    allowedAnimationStyles: ['2d', '3d', 'anime', 'clay', 'comic', 'cartoon', 'cyberpunk'], // 全部
  },
  studio: {
    name: 'Studio',
    videoResolutions: ['720p', '1080p'],
    creditsPerSecond: {
      '480p': 0, // 不支持
      '720p': 4,
      '1080p': 8,
    },
    maxImagesPerMonth: 500,
    maxStoryboardsPerMonth: 200,
    maxVoiceoverSecondsPerMonth: 900,
    maxDownloadsPerDay: null, // 无限制
    allowsStoryboard: true,
    allowsCommercialLicense: true,
    allowedAnimationStyles: ['2d', '3d', 'anime', 'clay', 'comic', 'cartoon', 'cyberpunk'], // 全部
  },
  null: {
    name: 'Free',
    videoResolutions: ['480p'],
    creditsPerSecond: {
      '480p': 4,
      '720p': 0,
      '1080p': 0,
    },
    maxImagesPerMonth: 10,
    maxStoryboardsPerMonth: 5,
    maxVoiceoverSecondsPerMonth: 30,
    maxDownloadsPerDay: 1,
    allowsStoryboard: false,
    allowsCommercialLicense: false,
    allowedAnimationStyles: ['2d'], // 只允许第一个
  },
};

/**
 * 根据订阅计划获取配置
 */
export function getSubscriptionPlanConfig(plan: SubscriptionPlan): SubscriptionPlanConfig {
  return SUBSCRIPTION_PLANS[plan] || SUBSCRIPTION_PLANS.null;
}

/**
 * 检查订阅计划是否支持某个分辨率
 */
export function isResolutionAllowed(plan: SubscriptionPlan, resolution: '480p' | '720p' | '1080p'): boolean {
  const config = getSubscriptionPlanConfig(plan);
  return config.videoResolutions.includes(resolution);
}

/**
 * 检查订阅计划是否支持分镜功能
 */
export function isStoryboardAllowed(plan: SubscriptionPlan): boolean {
  const config = getSubscriptionPlanConfig(plan);
  return config.allowsStoryboard;
}

/**
 * 检查订阅计划是否支持某个动画风格
 */
export function isAnimationStyleAllowed(plan: SubscriptionPlan, style: string): boolean {
  const config = getSubscriptionPlanConfig(plan);
  return config.allowedAnimationStyles.includes(style);
}

/**
 * 根据订阅计划和分辨率计算视频积分消耗（按秒）
 */
export function getVideoCreditsPerSecond(plan: SubscriptionPlan, resolution: '480p' | '720p' | '1080p'): number {
  const config = getSubscriptionPlanConfig(plan);
  return config.creditsPerSecond[resolution] || 0;
}

/**
 * 计算视频总积分消耗
 */
export function calculateVideoCredits(plan: SubscriptionPlan, resolution: '480p' | '720p' | '1080p', duration: number): number {
  const creditsPerSecond = getVideoCreditsPerSecond(plan, resolution);
  return Math.ceil(creditsPerSecond * duration);
}

