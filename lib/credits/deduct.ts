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
    console.log('Deducting credits:', { amount, description, metadata });
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
    console.log('Credits operate API response:', { status: response.status, result });

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'Failed to deduct credits',
      };
    }

    // 返回新的余额
    const balanceCheck = await checkCreditsBalance(0);
    return {
      success: true,
      newBalance: balanceCheck.balance,
    };
  } catch (error) {
    console.error('Error deducting credits:', error);
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
    console.error('Error checking credits balance:', error);
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
    console.error('Error adding credits:', error);
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
 * @param resolution 视频分辨率
 * @param duration 视频时长（秒）
 * @param metadata 元数据
 * @param subscriptionPlan 订阅计划（可选，如果提供则使用订阅计划相关的积分计算）
 */
export async function deductVideoCredits(
  resolution: '480p' | '720p' | '1080p',
  duration: number,
  metadata?: Record<string, any>,
  subscriptionPlan?: SubscriptionPlan
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
  // 如果提供了订阅计划，使用订阅计划相关的积分计算
  const credits = subscriptionPlan !== undefined 
    ? calculateVideoCredits(subscriptionPlan, resolution, duration)
    : getVideoCredits(resolution, duration);
    
  return await deductCredits(
    credits,
    `Generated ${duration}s ${resolution} video`,
    {
      ...metadata,
      resolution,
      duration,
      credits,
      subscriptionPlan: subscriptionPlan || null,
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
