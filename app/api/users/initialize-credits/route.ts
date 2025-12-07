import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/users/initialize-credits
 * 为新注册用户初始化积分（备用方案，如果数据库触发器失败）
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

    // 使用服务端客户端来绕过 RLS，检查是否已有 customer 记录
    const adminSupabase = createServiceClient();
    
    // 检查是否已有 customer 记录
    const { data: existingCustomer, error: checkError } = await adminSupabase
      .from('anim_customers')
      .select('id, credits')
      .eq('user_id', user.id)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found, which is OK
      console.error('[InitializeCredits] Error checking existing customer:', checkError);
      return NextResponse.json(
        { error: "Failed to check customer record" },
        { status: 500 }
      );
    }

    // 如果已有记录，返回现有积分
    if (existingCustomer) {
      return NextResponse.json({
        success: true,
        message: "Customer record already exists",
        credits: existingCustomer.credits,
      });
    }

    // 创建新的 customer 记录
    const { data: newCustomer, error: createError } = await adminSupabase
      .from('anim_customers')
      .insert({
        user_id: user.id,
        email: user.email || '',
        credits: 15,
        creem_customer_id: `auto_${user.id}`,
        metadata: {
          source: 'api_initialization',
          initial_credits: 15,
          registration_date: new Date().toISOString(),
        },
      })
      .select('id')
      .single();

    if (createError || !newCustomer) {
      console.error('[InitializeCredits] Error creating customer:', createError);
      return NextResponse.json(
        { error: "Failed to create customer record" },
        { status: 500 }
      );
    }

    // 创建积分历史记录
    const { error: historyError } = await adminSupabase
      .from('anim_credits_history')
      .insert({
        customer_id: newCustomer.id,
        amount: 15,
        type: 'add',
        description: 'Welcome bonus for new user registration',
        metadata: {
          source: 'welcome_bonus',
          user_registration: true,
          initialized_by: 'api',
        },
      });

    if (historyError) {
      console.error('[InitializeCredits] Error creating credits history:', historyError);
      // 不返回错误，因为 customer 记录已创建成功
    }

    return NextResponse.json({
      success: true,
      message: "Credits initialized successfully",
      credits: 15,
    });
  } catch (error) {
    console.error('[InitializeCredits] Unexpected error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to initialize credits",
      },
      { status: 500 }
    );
  }
}

