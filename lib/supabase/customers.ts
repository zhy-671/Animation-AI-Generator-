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
 */
export async function operateCredits(params: CreditOperationParams): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  
  // 验证用户身份
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'User not authenticated' }
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
  const serviceClient = createServiceClient();
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
    console.error('Failed to insert credits history:', historyError);
    // 如果历史记录失败，回滚积分更新（使用服务端客户端）
    await serviceClient
      .from('anim_customers')
      .update({ credits: customer.credits })
      .eq('id', customer.id)
    
    return { 
      success: false, 
      error: `Failed to record credits history: ${historyError.message}` 
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

