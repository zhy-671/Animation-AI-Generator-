import { createClient } from '@/lib/supabase/client'
import type { AnimCustomer, CreditsHistory } from '@/lib/supabase/types'

/**
 * 客户端：获取当前用户的客户信息
 */
export async function getCurrentCustomerClient(): Promise<AnimCustomer | null> {
  const supabase = createClient()
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
 * 客户端：获取用户的积分余额
 */
export async function getCreditsClient(): Promise<number> {
  const customer = await getCurrentCustomerClient()
  return customer?.credits ?? 0
}

/**
 * 客户端：获取用户的积分历史记录
 */
export async function getCreditsHistoryClient(limit: number = 50): Promise<CreditsHistory[]> {
  const supabase = createClient()
  const customer = await getCurrentCustomerClient()

  if (!customer) {
    return []
  }

  const { data, error } = await supabase
    .from('credits_history')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) {
    return []
  }

  return data as CreditsHistory[]
}

