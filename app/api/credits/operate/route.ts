import { NextRequest, NextResponse } from 'next/server'
import { operateCredits, getCurrentCustomer, getCredits } from '@/lib/supabase/customers'
import { createClient } from '@/lib/supabase/server'
import type { CreditOperationParams } from '@/lib/supabase/types'

/**
 * Helper function to add CORS headers (same as balance endpoint)
 */
function addCorsHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get('origin')
  
  const allowedOrigins = [
    'https://videoaimusic.com',
    'https://www.videoaimusic.com',
    'http://localhost:3000',
    'http://localhost:3001',
  ]
  
  const isAllowedOrigin = origin && (
    allowedOrigins.includes(origin) ||
    origin.includes('localhost')
  )
  
  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  }
  
  const requestedMethod = request.headers.get('Access-Control-Request-Method')
  const requestedHeaders = request.headers.get('Access-Control-Request-Headers')
  
  if (requestedMethod) {
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  } else {
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  }
  
  const allowedHeaders = [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Referer',
    'User-Agent',
    'sec-fetch-mode',
    'sec-fetch-site',
    'sec-fetch-dest',
    'sec-ch-ua',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform',
  ]
  
  if (requestedHeaders) {
    const requestedHeadersList = requestedHeaders.split(',').map(h => h.trim().toLowerCase())
    const mergedHeaders = [...new Set([...allowedHeaders.map(h => h.toLowerCase()), ...requestedHeadersList])]
    response.headers.set('Access-Control-Allow-Headers', mergedHeaders.join(', '))
  } else {
    response.headers.set('Access-Control-Allow-Headers', allowedHeaders.join(', '))
  }
  
  response.headers.set('Access-Control-Max-Age', '86400')
  
  return response
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 })
  return addCorsHeaders(response, request)
}

export async function POST(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response = NextResponse.json(
        { error: 'User not authenticated', details: 'Missing or invalid Authorization header' },
        { status: 401 }
      )
      return addCorsHeaders(response, request)
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify token and get user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      // Log detailed error for debugging
      console.error('[Credits Operate API] Token validation failed:', {
        hasToken: !!token,
        tokenLength: token?.length,
        error: authError?.message,
        errorName: authError?.name,
        hasUser: !!user,
      })
      
      const response = NextResponse.json(
        { 
          error: 'User not authenticated', 
          details: authError?.message || 'Invalid token',
          hint: authError?.message?.includes('expired') ? 'Token may be expired. Please refresh your session.' : undefined
        },
        { status: 401 }
      )
      return addCorsHeaders(response, request)
    }

    const body: Partial<CreditOperationParams> = await request.json()
    
    // Get customer record using the verified user
    const { data: customer, error: customerError } = await supabase
      .from('anim_customers')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (customerError || !customer) {
      const response = NextResponse.json(
        { error: 'Customer not found. Please ensure you are logged in.', details: customerError?.message },
        { status: 401 }
      )
      return addCorsHeaders(response, request)
    }
    // 验证必需字段（customerId 自动使用当前用户的）
    if (!body.amount || !body.type) {
      const response = NextResponse.json(
        { error: 'Missing required fields: amount, type' },
        { status: 400 }
      )
      return addCorsHeaders(response, request)
    }

    // 验证积分数量
    if (body.amount <= 0) {
      const response = NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
      return addCorsHeaders(response, request)
    }

    // 🔒 安全措施：禁止用户直接通过API增加积分
    // 只有通过支付webhook才能增加积分
    if (body.type === 'add') {
      // 检查是否有对应的已完成支付订单
      const supabase = await createClient()
      const orderId = body.metadata?.order_id
      
      if (!orderId) {
        const response = NextResponse.json(
          { error: 'Cannot add credits without a valid payment order. Credits can only be added through payment webhooks.' },
          { status: 403 }
        )
        return addCorsHeaders(response, request)
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
        const response = NextResponse.json(
          { error: 'Invalid or incomplete payment order. Credits can only be added through verified payment webhooks.' },
          { status: 403 }
        )
        return addCorsHeaders(response, request)
      }

      // 验证积分数量是否匹配订单
      if (order.credits_amount !== body.amount) {
        const response = NextResponse.json(
          { error: 'Credit amount does not match the payment order.' },
          { status: 403 }
        )
        return addCorsHeaders(response, request)
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
        const response = NextResponse.json(
          { error: 'Credits for this order have already been added.' },
          { status: 409 }
        )
        return addCorsHeaders(response, request)
      }
    }

    // 检查积分是否足够（如果是扣除操作）
    if (body.type === 'subtract' && customer.credits < body.amount) {
      const response = NextResponse.json(
        { error: 'Insufficient credits', success: false },
        { status: 400 }
      )
      return addCorsHeaders(response, request)
    }

    // 构建完整的操作参数
    const params: CreditOperationParams = {
      customerId: customer.id,
      amount: body.amount,
      type: body.type,
      description: body.description,
      metadata: body.metadata,
    }
    // 执行积分操作（传入 token）
    const result = await operateCredits(params, token)
    if (!result.success) {
      const response = NextResponse.json(
        { error: result.error || 'Failed to operate credits', success: false },
        { status: 400 }
      )
      return addCorsHeaders(response, request)
    }

    // 获取更新后的积分余额
    const newBalance = await getCredits()
    const response = NextResponse.json({ 
      success: true,
      credits: newBalance,
    })
    return addCorsHeaders(response, request)
  } catch (error) {
    const response = NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    )
    return addCorsHeaders(response, request)
  }
}

