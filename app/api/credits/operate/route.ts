import { NextRequest, NextResponse } from 'next/server'
import { operateCredits, getCurrentCustomer, getCredits } from '@/lib/supabase/customers'
import { createClient } from '@/lib/supabase/server'
import type { CreditOperationParams } from '@/lib/supabase/types'

export async function POST(request: NextRequest) {
  try {
    const body: Partial<CreditOperationParams> = await request.json()
    // 获取当前用户的客户信息
    const customer = await getCurrentCustomer()
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found. Please ensure you are logged in.' },
        { status: 401 }
      )
    }
    // 验证必需字段（customerId 自动使用当前用户的）
    if (!body.amount || !body.type) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, type' },
        { status: 400 }
      )
    }

    // 验证积分数量
    if (body.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    // 🔒 安全措施：禁止用户直接通过API增加积分
    // 只有通过支付webhook才能增加积分
    if (body.type === 'add') {
      // 检查是否有对应的已完成支付订单
      const supabase = await createClient()
      const orderId = body.metadata?.order_id
      
      if (!orderId) {
        return NextResponse.json(
          { error: 'Cannot add credits without a valid payment order. Credits can only be added through payment webhooks.' },
          { status: 403 }
        )
      }

      // 验证订单存在且已完成
      const { data: order, error: orderError } = await supabase
        .from('payment_orders')
        .select('*')
        .eq('id', orderId)
        .eq('customer_id', customer.id)
        .eq('status', 'completed')
        .single()

      if (orderError || !order) {
        return NextResponse.json(
          { error: 'Invalid or incomplete payment order. Credits can only be added through verified payment webhooks.' },
          { status: 403 }
        )
      }

      // 验证积分数量是否匹配订单
      if (order.credits_amount !== body.amount) {
        return NextResponse.json(
          { error: 'Credit amount does not match the payment order.' },
          { status: 403 }
        )
      }

      // 检查是否已经处理过这个订单的积分（防止重复添加）
      const { data: existingHistory } = await supabase
        .from('anim_credits_history')
        .select('id')
        .eq('customer_id', customer.id)
        .eq('type', 'add')
        .eq('amount', body.amount)
        .contains('metadata', { order_id: orderId })
        .limit(1)

      if (existingHistory && existingHistory.length > 0) {
        return NextResponse.json(
          { error: 'Credits for this order have already been added.' },
          { status: 409 }
        )
      }
    }

    // 检查积分是否足够（如果是扣除操作）
    if (body.type === 'subtract' && customer.credits < body.amount) {
      return NextResponse.json(
        { error: 'Insufficient credits', success: false },
        { status: 400 }
      )
    }

    // 构建完整的操作参数
    const params: CreditOperationParams = {
      customerId: customer.id,
      amount: body.amount,
      type: body.type,
      description: body.description,
      metadata: body.metadata,
    }
    // 执行积分操作
    const result = await operateCredits(params)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to operate credits', success: false },
        { status: 400 }
      )
    }

    // 获取更新后的积分余额
    const newBalance = await getCredits()
    return NextResponse.json({ 
      success: true,
      credits: newBalance,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    )
  }
}

