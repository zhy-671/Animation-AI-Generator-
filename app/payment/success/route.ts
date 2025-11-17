import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * 支付成功页面
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const orderId = searchParams.get('order_id');
  const status = searchParams.get('status');

  // 如果支付成功，重定向到pricing页面并显示成功消息
  if (status === 'success' && orderId) {
    return NextResponse.redirect(
      new URL(`/pricing?payment_status=success&order_id=${orderId}`, request.url)
    );
  }

  // 如果支付失败或取消，重定向到pricing页面并显示错误消息
  return NextResponse.redirect(
    new URL(`/pricing?payment_status=failed`, request.url)
  );
}

