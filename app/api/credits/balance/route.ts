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
    let supabase;
    try {
      supabase = await createClient()
    } catch (clientError) {
      return NextResponse.json(
        { error: 'Authentication service unavailable', details: 'Unable to create authentication client' },
        { status: 503 }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      // Handle AuthSessionMissingError gracefully - user is not logged in
      if (authError.name === 'AuthSessionMissingError' || authError.message?.includes('session')) {
        return NextResponse.json(
          { error: 'User not authenticated', details: 'No active session' },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: 'Authentication failed', details: authError.message },
        { status: 401 }
      )
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }
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
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

