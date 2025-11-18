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
  allowsStoryboard: boolean;
  allowsCommercialLicense: boolean;
  allowsCompleteVideoExport: boolean; // 是否允许合成视频导出
  allowedAnimationStyles: string[]; // 允许的动画风格
}

export const SUBSCRIPTION_PLANS: Record<Exclude<SubscriptionPlan, null>, SubscriptionPlanConfig> & { null: SubscriptionPlanConfig } = {
  basic: {
    name: 'Basic',
    videoResolutions: ['480p', '720p'],
    creditsPerSecond: {
      '480p': 15, // 统一按720p费率扣除，防止薅羊毛
      '720p': 15,
      '1080p': 0, // 不支持
    },
    maxImagesPerMonth: 50,
    maxStoryboardsPerMonth: 20,
    maxVoiceoverSecondsPerMonth: 60,
    allowsStoryboard: false, // Basic计划不支持分镜
    allowsCommercialLicense: false,
    allowsCompleteVideoExport: false, // Basic计划不允许合成视频导出
    allowedAnimationStyles: ['2d', '3d', 'anime'], // 只允许前3个
  },
  pro: {
    name: 'Pro',
    videoResolutions: ['480p', '720p', '1080p'],
    creditsPerSecond: {
      '480p': 15, // 480p和720p按720p费率扣除（15积分/秒）
      '720p': 15, // 480p和720p按720p费率扣除（15积分/秒）
      '1080p': 24, // 1080p按1080p费率扣除（24积分/秒）
    },
    maxImagesPerMonth: 200,
    maxStoryboardsPerMonth: 100,
    maxVoiceoverSecondsPerMonth: 300,
    allowsStoryboard: true,
    allowsCommercialLicense: true,
    allowsCompleteVideoExport: true, // Pro计划允许合成视频导出
    allowedAnimationStyles: ['2d', '3d', 'anime', 'clay', 'comic', 'cartoon', 'cyberpunk'], // 全部
  },
  studio: {
    name: 'Studio',
    videoResolutions: ['720p', '1080p'],
    creditsPerSecond: {
      '480p': 0, // 不支持
      '720p': 24, // 统一按1080p费率扣除，防止薅羊毛
      '1080p': 24,
    },
    maxImagesPerMonth: 500,
    maxStoryboardsPerMonth: 200,
    maxVoiceoverSecondsPerMonth: 900,
    allowsStoryboard: true,
    allowsCommercialLicense: true,
    allowsCompleteVideoExport: true, // Studio计划允许合成视频导出
    allowedAnimationStyles: ['2d', '3d', 'anime', 'clay', 'comic', 'cartoon', 'cyberpunk'], // 全部
  },
  null: {
    name: 'Free',
    videoResolutions: ['480p', '720p'],
    creditsPerSecond: {
      '480p': 15, // 统一按720p费率扣除，防止薅羊毛
      '720p': 15,
      '1080p': 0, // 不支持
    },
    maxImagesPerMonth: 10,
    maxStoryboardsPerMonth: 5,
    maxVoiceoverSecondsPerMonth: 30,
    allowsStoryboard: false,
    allowsCommercialLicense: false,
    allowsCompleteVideoExport: false, // Free计划不允许合成视频导出
    allowedAnimationStyles: ['2d'], // 只允许第一个
  },
};

/**
 * 根据订阅计划获取配置
 */
export function getSubscriptionPlanConfig(plan: SubscriptionPlan): SubscriptionPlanConfig {
  if (plan === null) {
    return SUBSCRIPTION_PLANS.null;
  }
  return SUBSCRIPTION_PLANS[plan];
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
 * 检查订阅计划是否允许合成视频导出
 */
export function isCompleteVideoExportAllowed(plan: SubscriptionPlan): boolean {
  const config = getSubscriptionPlanConfig(plan);
  return config.allowsCompleteVideoExport;
}

/**
 * 根据订阅计划和分辨率计算视频积分消耗（按秒）
 * 注意：此函数会根据订阅计划强制使用高分辨率费率（防薅羊毛机制）
 */
export function getVideoCreditsPerSecond(plan: SubscriptionPlan, resolution: '480p' | '720p' | '1080p'): number {
  const config = getSubscriptionPlanConfig(plan);
  
  // 防薅羊毛机制：根据订阅计划强制使用高分辨率费率
  if (plan === 'basic') {
    // Basic计划：统一按720p费率（15积分/秒）
    return config.creditsPerSecond['720p'] || 15;
  } else if (plan === 'pro') {
    // Pro计划：480p和720p按720p费率（15积分/秒），1080p按1080p费率（24积分/秒）
    if (resolution === '1080p') {
      return config.creditsPerSecond['1080p'] || 24;
    } else {
      return config.creditsPerSecond['720p'] || 15;
    }
  } else if (plan === 'studio') {
    // Studio计划：统一按1080p费率（24积分/秒）
    return config.creditsPerSecond['1080p'] || 24;
  }
  
  // 其他情况返回原分辨率费率
  return config.creditsPerSecond[resolution] || 0;
}

/**
 * 计算视频总积分消耗
 * 注意：此函数会根据订阅计划强制使用高分辨率费率（防薅羊毛机制）
 * @param plan 订阅计划
 * @param resolution 用户选择的分辨率（可能被强制提升）
 * @param duration 视频时长（秒）
 */
export function calculateVideoCredits(plan: SubscriptionPlan, resolution: '480p' | '720p' | '1080p', duration: number): number {
  // 防薅羊毛机制：根据订阅计划强制使用高分辨率费率
  let actualResolution: '480p' | '720p' | '1080p' = resolution;
  
  if (plan === 'basic') {
    // Basic计划：统一按720p费率扣除
    actualResolution = '720p';
  } else if (plan === 'pro') {
    // Pro计划：480p和720p按720p费率扣除，1080p按1080p费率扣除
    if (resolution === '1080p') {
      actualResolution = '1080p';
    } else {
      actualResolution = '720p';
    }
  } else if (plan === 'studio') {
    // Studio计划：统一按1080p费率扣除
    actualResolution = '1080p';
  }
  
  const creditsPerSecond = getVideoCreditsPerSecond(plan, actualResolution);
  return Math.ceil(creditsPerSecond * duration);
}

