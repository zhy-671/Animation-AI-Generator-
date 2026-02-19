/**
 * 积分规则配置
 * 根据视频长度和清晰度计算积分消耗
 */

export interface CreditRule {
  type: 'image' | 'video';
  resolution?: '480p' | '720p' | '1080p';
  duration?: 5 | 10; // 秒
  credits: number;
  costCNY: number;
  costUSD: number;
}

export const CREDIT_RULES: CreditRule[] = [
  {
    type: 'image',
    credits: 5,
    costCNY: 0.2,
    costUSD: 0.03,
  },
  {
    type: 'video',
    resolution: '480p',
    duration: 5,
    credits: 15,
    costCNY: 3.2,
    costUSD: 0.45,
  },
  {
    type: 'video',
    resolution: '480p',
    duration: 10,
    credits: 30,
    costCNY: 6.2,
    costUSD: 0.90,
  },
  {
    type: 'video',
    resolution: '720p',
    duration: 5,
    credits: 20,
    costCNY: 3.8,
    costUSD: 0.60,
  },
  {
    type: 'video',
    resolution: '720p',
    duration: 10,
    credits: 40,
    costCNY: 7.4,
    costUSD: 1.20,
  },
  {
    type: 'video',
    resolution: '1080p',
    duration: 5,
    credits: 30,
    costCNY: 5.2,
    costUSD: 0.90,
  },
  {
    type: 'video',
    resolution: '1080p',
    duration: 10,
    credits: 60,
    costCNY: 10.2,
    costUSD: 1.80,
  },
];

/**
 * 计算图片生成所需的积分
 */
export function getImageCredits(): number {
  const rule = CREDIT_RULES.find(r => r.type === 'image');
  return rule?.credits || 5;
}

/**
 * 计算视频生成所需的积分
 * @param resolution 视频分辨率
 * @param duration 视频时长（秒）
 */
export function getVideoCredits(resolution: '480p' | '720p' | '1080p', duration: number): number {
  // 将时长转换为最接近的5或10秒
  const normalizedDuration = duration <= 5 ? 5 : 10;
  
  const rule = CREDIT_RULES.find(
    r => r.type === 'video' && 
    r.resolution === resolution && 
    r.duration === normalizedDuration
  );
  
  if (rule) {
    return rule.credits;
  }
  
  // 如果没有找到精确匹配，使用线性插值估算
  // 基于最接近的规则进行估算
  const baseRule = CREDIT_RULES.find(
    r => r.type === 'video' && r.resolution === resolution
  );
  
  if (baseRule && baseRule.duration) {
    // 按比例计算
    const creditsPerSecond = baseRule.credits / baseRule.duration;
    return Math.ceil(creditsPerSecond * duration);
  }
  
  // 默认值
  return 15;
}

/**
 * 计算分镜场景所需的积分
 * 分镜场景 = 图片 + 可能的视频
 */
export function getStoryboardSceneCredits(includeVideo: boolean = false, resolution?: '480p' | '720p' | '1080p', duration?: number): number {
  let credits = getImageCredits(); // 基础图片积分
  
  if (includeVideo && resolution && duration) {
    credits += getVideoCredits(resolution, duration);
  }
  
  return credits;
}

/**
 * 获取所有积分规则的说明文本
 */
export function getCreditRulesDescription(): Array<{
  label: string;
  credits: number;
  description: string;
}> {
  return [
    {
      label: '1 AI Image',
      credits: 5,
      description: 'Generate storyboard images or cover images',
    },
    {
      label: '5s Video (480p)',
      credits: 15,
      description: 'Standard definition video generation',
    },
    {
      label: '10s Video (480p)',
      credits: 30,
      description: 'Standard definition video generation',
    },
    {
      label: '5s Video (720p)',
      credits: 20,
      description: 'High definition video generation',
    },
    {
      label: '10s Video (720p)',
      credits: 40,
      description: 'High definition video generation',
    },
    {
      label: '5s Video (1080p)',
      credits: 30,
      description: 'Full HD video generation',
    },
    {
      label: '10s Video (1080p)',
      credits: 60,
      description: 'Full HD video generation',
    },
    {
      label: 'Storyboard Scene',
      credits: 2,
      description: 'Complete storyboard generation with images (2-3 credits)',
    },
  ];
}

