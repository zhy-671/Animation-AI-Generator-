// Supabase 数据库类型定义

export interface AnimCustomer {
  id: string
  user_id: string
  email: string
  credits: number
  creem_customer_id: string | null
  created_at: string
  updated_at: string
  metadata: Record<string, any>
}

export interface CreditsHistory {
  id: string
  customer_id: string
  amount: number
  type: 'add' | 'subtract' | 'expire' | 'refund'
  description: string | null
  created_at: string
  metadata: Record<string, any>
}

export interface CreditsHistoryWithCustomer extends CreditsHistory {
  anim_customers?: AnimCustomer
}

// 积分操作类型
export type CreditOperationType = 'add' | 'subtract' | 'expire' | 'refund'

// 积分操作参数
export interface CreditOperationParams {
  customerId: string
  amount: number
  type: CreditOperationType
  description?: string
  metadata?: Record<string, any>
}

