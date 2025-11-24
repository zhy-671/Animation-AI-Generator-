/**
 * 积分扣除工具函数
 */

import { getImageCredits, getVideoCredits } from './rules';
import { calculateVideoCredits, type SubscriptionPlan } from '../subscription/rules';

/**
 * 扣除积分
 * @param amount 积分数量
 * @param description 描述
 * @param metadata 元数据
 */
export async function deductCredits(
  amount: number,
  description: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
  try {
    const response = await fetch('/api/credits/operate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        type: 'subtract',
        description,
        metadata,
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'Failed to deduct credits',
      };
    }

    // 从API响应中直接获取新余额（API返回credits字段）
    if (result.credits !== undefined) {
      return {
        success: true,
        newBalance: result.credits,
      };
    }

    // 如果API没有返回余额，再次查询
    const balanceCheck = await checkCreditsBalance(0);
    return {
      success: true,
      newBalance: balanceCheck.balance,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deduct credits',
    };
  }
}

/**
 * 检查积分余额是否足够
 * @param required 需要的积分数量
 */
export async function checkCreditsBalance(required: number): Promise<{ sufficient: boolean; balance?: number; error?: string }> {
  try {
    const response = await fetch('/api/credits/balance');
    const result = await response.json();

    if (!response.ok) {
      // If user is not authenticated (401), return gracefully without error
      // This is expected when user is not logged in
      if (response.status === 401) {
        return {
          sufficient: false,
          balance: 0,
        };
      }
      
      return {
        sufficient: false,
        error: result.error || 'Failed to check credits balance',
      };
    }

    const balance = result.credits || 0;
    return {
      sufficient: balance >= required,
      balance,
    };
  } catch (error) {
    return {
      sufficient: false,
      error: error instanceof Error ? error.message : 'Failed to check credits balance',
    };
  }
}

/**
 * 添加积分（用于支付成功后）
 * @param amount 积分数量
 * @param description 描述
 * @param metadata 元数据
 */
export async function addCredits(
  amount: number,
  description: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
  try {
    const response = await fetch('/api/credits/operate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        type: 'add',
        description,
        metadata,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'Failed to add credits',
      };
    }

    // 返回新的余额
    const balanceCheck = await checkCreditsBalance(0);
    return {
      success: true,
      newBalance: balanceCheck.balance,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add credits',
    };
  }
}

/**
 * 扣除图片生成积分
 */
export async function deductImageCredits(metadata?: Record<string, any>): Promise<{ success: boolean; error?: string; newBalance?: number }> {
  const credits = getImageCredits();
  return await deductCredits(credits, 'Generated AI image', metadata);
}

/**
 * 扣除视频生成积分
 * @param resolution 视频分辨率（用户选择的分辨率）
 * @param duration 视频时长（秒）
 * @param metadata 元数据
 * @param subscriptionPlan 订阅计划（可选，如果提供则使用订阅计划相关的积分计算）
 * @param isPaidUser 是否为充值用户（无订阅但充值了积分）
 */
export async function deductVideoCredits(
  resolution: '480p' | '720p' | '1080p',
  duration: number,
  metadata?: Record<string, any>,
  subscriptionPlan?: SubscriptionPlan,
  isPaidUser?: boolean
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
  let credits: number;
  let actualResolution: '480p' | '720p' | '1080p' = resolution;
  
  if (subscriptionPlan !== undefined && subscriptionPlan !== null) {
    // 订阅用户：根据订阅计划强制使用高分辨率费率
    // Basic计划：统一按720p费率（15积分/秒）
    // Pro计划：480p和720p按720p费率（15积分/秒），1080p按1080p费率（24积分/秒）
    // Studio计划：统一按1080p费率（24积分/秒）
    if (subscriptionPlan === 'basic') {
      // Basic用户无论选择什么分辨率，都按720p费率扣除
      actualResolution = '720p';
      credits = calculateVideoCredits(subscriptionPlan, '720p', duration);
    } else if (subscriptionPlan === 'pro') {
      // Pro用户：480p和720p按720p费率扣除，1080p按1080p费率扣除
      if (resolution === '1080p') {
        actualResolution = '1080p';
        credits = calculateVideoCredits(subscriptionPlan, '1080p', duration);
      } else {
        actualResolution = '720p';
        credits = calculateVideoCredits(subscriptionPlan, '720p', duration);
      }
    } else if (subscriptionPlan === 'studio') {
      // Studio用户无论选择什么分辨率，都按1080p费率扣除
      actualResolution = '1080p';
      credits = calculateVideoCredits(subscriptionPlan, '1080p', duration);
    } else {
      // 其他情况使用原分辨率计算
      credits = calculateVideoCredits(subscriptionPlan, resolution, duration);
    }
  } else if (isPaidUser) {
    // 充值用户（无订阅）：统一按720p费率扣除（15积分/秒）
    actualResolution = '720p';
    credits = getVideoCredits('720p', duration);
  } else {
    // Free用户或其他情况：统一按720p费率扣除（15积分/秒）
    actualResolution = '720p';
    credits = getVideoCredits('720p', duration);
  }
    
  return await deductCredits(
    credits,
    `Generated ${duration}s ${resolution} video (charged at ${actualResolution} rate)`,
    {
      ...metadata,
      resolution,
      actualResolution, // 实际扣除费率对应的分辨率
      duration,
      credits,
      subscriptionPlan: subscriptionPlan || null,
      isPaidUser: isPaidUser || false,
    }
  );
}

/**
 * 扣除分镜生成积分
 * 分镜生成固定消耗20积分
 */
export async function deductStoryboardCredits(metadata?: Record<string, any>): Promise<{ success: boolean; error?: string; newBalance?: number }> {
  const STORYBOARD_CREDITS = 20;
  return await deductCredits(
    STORYBOARD_CREDITS,
    'Generated storyboard',
    {
      ...metadata,
      type: 'storyboard',
      credits: STORYBOARD_CREDITS,
    }
  );
}
