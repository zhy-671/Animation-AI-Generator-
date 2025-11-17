import { NextResponse } from 'next/server'
import { getCurrentCustomer, getCreditsHistory } from '@/lib/supabase/customers'

/**
 * GET /api/credits/balance
 * 获取当前用户的积分余额
 */
export async function GET() {
  try {
    const customer = await getCurrentCustomer()

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      credits: customer.credits,
      customerId: customer.id,
    })
  } catch (error) {
    console.error('Error getting credits balance:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

