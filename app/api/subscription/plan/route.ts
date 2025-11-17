import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * 获取用户订阅计划
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 查询用户订阅信息
    const { data: customer, error: customerError } = await supabase
      .from('anim_customers')
      .select('subscription_plan, subscription_expires_at')
      .eq('user_id', user.id)
      .single();

    if (customerError) {
      console.error('Error fetching subscription plan:', customerError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch subscription plan' },
        { status: 500 }
      );
    }

    // 检查订阅是否过期
    let plan: 'basic' | 'pro' | 'studio' | null = null;
    if (customer?.subscription_plan) {
      const expiresAt = customer.subscription_expires_at;
      if (expiresAt && new Date(expiresAt) > new Date()) {
        plan = customer.subscription_plan as 'basic' | 'pro' | 'studio';
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        plan,
        expiresAt: customer?.subscription_expires_at || null,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/subscription/plan:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

