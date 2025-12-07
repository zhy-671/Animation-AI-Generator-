import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { AnimCustomer, CreditsHistory, CreditOperationParams } from '@/lib/supabase/types'

/**
 * 获取当前用户的客户信息
 */
export async function getCurrentCustomer(): Promise<AnimCustomer | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('anim_customers')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error || !data) {
    return null
  }

  return data as AnimCustomer
}

/**
 * 获取用户的积分余额
 */
export async function getCredits(): Promise<number> {
  const customer = await getCurrentCustomer()
  return customer?.credits ?? 0
}

/**
 * 获取用户的积分历史记录
 */
export async function getCreditsHistory(limit: number = 50): Promise<CreditsHistory[]> {
  const supabase = await createClient()
  const customer = await getCurrentCustomer()

  if (!customer) {
    return []
  }

  const { data, error } = await supabase
    .from('anim_credits_history')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) {
    return []
  }

  return data as CreditsHistory[]
}

/**
 * 操作积分（添加、扣除等）
 * 注意：这个函数需要服务端权限，应该通过 API Route 调用
 * @param params 积分操作参数
 * @param token 可选的 Bearer token，如果不提供则从 cookie 获取（向后兼容）
 */
export async function operateCredits(params: CreditOperationParams, token?: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  
  // 验证用户身份
  let user;
  if (token) {
    // 使用提供的 token 验证用户
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) {
      return { success: false, error: 'User not authenticated' }
    }
    user = data.user
  } else {
    // 向后兼容：从 cookie 获取用户（如果 token 未提供）
    const { data: { user: cookieUser } } = await supabase.auth.getUser()
    if (!cookieUser) {
      return { success: false, error: 'User not authenticated' }
    }
    user = cookieUser
  }

  // 获取客户信息（验证 customerId 属于当前用户）
  const { data: customer } = await supabase
    .from('anim_customers')
    .select('*')
    .eq('id', params.customerId)
    .eq('user_id', user.id)
    .single()

  if (!customer) {
    return { success: false, error: 'Customer record not found or access denied' }
  }

  // 检查积分是否足够（如果是扣除操作）
  if (params.type === 'subtract' && customer.credits < params.amount) {
    return { success: false, error: 'Insufficient credits' }
  }

  // 计算新积分
  const newCredits = params.type === 'add' 
    ? customer.credits + params.amount
    : customer.credits - params.amount

  // 更新积分
  const { error: updateError } = await supabase
    .from('anim_customers')
    .update({ credits: newCredits })
    .eq('id', customer.id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // 记录积分历史（使用服务端权限，绕过RLS）
  // 使用服务端权限客户端来插入历史记录，避免RLS策略问题
  let serviceClient;
  try {
    serviceClient = createServiceClient();
  } catch (clientError) {
    return { 
      success: false, 
      error: `Failed to create service client: ${clientError instanceof Error ? clientError.message : 'Unknown error'}. Please check SUPABASE_SERVICE_ROLE_KEY configuration.` 
    };
  }
  
  const { error: historyError } = await serviceClient
    .from('anim_credits_history')
    .insert({
      customer_id: customer.id,
      amount: params.amount,
      type: params.type,
      description: params.description || null,
      metadata: params.metadata || {},
    })

  if (historyError) {
    // 如果历史记录失败，回滚积分更新（使用服务端客户端）
    try {
      await serviceClient
        .from('anim_customers')
        .update({ credits: customer.credits })
        .eq('id', customer.id);
    } catch (rollbackError) {
      console.error('[Credits] Failed to rollback credits update:', rollbackError);
    }
    
    // 提供更详细的错误信息
    let errorMessage = `Failed to record credits history: ${historyError.message}`;
    if (historyError.message.includes('Invalid API key') || historyError.message.includes('JWT')) {
      errorMessage += '. Please check if SUPABASE_SERVICE_ROLE_KEY is correctly configured in your environment variables.';
    }
    
    return { 
      success: false, 
      error: errorMessage
    }
  }

  return { success: true }
}

/**
 * 检查用户是否有足够的积分
 */
export async function hasEnoughCredits(required: number): Promise<boolean> {
  const credits = await getCredits()
  return credits >= required
}

