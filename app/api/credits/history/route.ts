import { NextRequest, NextResponse } from 'next/server'
import { getCreditsHistory } from '@/lib/supabase/customers'

/**
 * GET /api/credits/history?limit=50
 * 获取当前用户的积分历史记录
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const history = await getCreditsHistory(limit)

    return NextResponse.json({
      history,
      count: history.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

