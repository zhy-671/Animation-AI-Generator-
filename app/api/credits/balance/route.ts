import { NextResponse } from 'next/server'
import { getCurrentCustomer, getCreditsHistory } from '@/lib/supabase/customers'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/credits/balance
 * 获取当前用户的积分余额
 */
export async function GET() {
  try {
    // First verify user authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error('Auth error in balance API:', authError)
      return NextResponse.json(
        { error: 'Authentication failed', details: authError.message },
        { status: 401 }
      )
    }

    if (!user) {
      console.log('No user found in balance API')
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    console.log('Balance API: Fetching customer for user:', user.id)
    const customer = await getCurrentCustomer()

    if (!customer) {
      console.log('Balance API: Customer not found for user:', user.id)
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    console.log('Balance API: Returning credits for customer:', customer.id, 'credits:', customer.credits)
    return NextResponse.json({
      credits: customer.credits,
      customerId: customer.id,
    })
  } catch (error) {
    console.error('Error getting credits balance:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

