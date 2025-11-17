import { NextRequest, NextResponse } from 'next/server';

/**
 * 支付取消页面
 */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(
    new URL('/pricing?payment_status=cancelled', request.url)
  );
}

