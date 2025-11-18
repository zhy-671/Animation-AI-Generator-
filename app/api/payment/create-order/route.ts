import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentCustomer } from '@/lib/supabase/customers';
import { createCreemOrder } from '@/lib/payment/creem';
import { SUBSCRIPTION_PLANS, CREDIT_PACKAGES } from '@/lib/payment/config';
import type { CreatePaymentOrderRequest } from '@/lib/payment/types';

/**
 * 创建支付订单
 */
export async function POST(request: NextRequest) {
  try {
    console.log('=== Creating payment order ===');
    const supabase = await createClient();
    
    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please login first.' },
        { status: 401 }
      );
    }
    console.log('User authenticated:', user.id);

    // 获取当前用户的客户信息
    const customer = await getCurrentCustomer();
    if (!customer) {
      console.error('Customer not found for user:', user.id);
      return NextResponse.json(
        { success: false, error: 'Customer not found. Please contact support.' },
        { status: 404 }
      );
    }
    console.log('Customer found:', customer.id);

    // 解析请求体
    const body: CreatePaymentOrderRequest = await request.json();
    const { order_type, plan_name, credit_package_name, credits_amount } = body;
    console.log('Order request:', { order_type, plan_name, credit_package_name });

    // 验证订单类型和参数
    if (order_type === 'subscription') {
      if (!plan_name || !SUBSCRIPTION_PLANS[plan_name]) {
        return NextResponse.json(
          { success: false, error: 'Invalid subscription plan' },
          { status: 400 }
        );
      }
    } else if (order_type === 'credits') {
      if (!credit_package_name || !CREDIT_PACKAGES[credit_package_name]) {
        return NextResponse.json(
          { success: false, error: 'Invalid credit package' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid order type' },
        { status: 400 }
      );
    }

    // 计算订单金额和描述
    let amount: number;
    let description: string;
    let creditsToAdd: number | null = null;

    if (order_type === 'subscription') {
      const plan = SUBSCRIPTION_PLANS[plan_name!];
      amount = plan.price;
      creditsToAdd = plan.credits;
      description = `Subscription: ${plan_name} Plan - ${creditsToAdd} credits/month`;
    } else {
      const packageInfo = CREDIT_PACKAGES[credit_package_name!];
      amount = packageInfo.price;
      creditsToAdd = packageInfo.credits;
      description = `Credit Purchase: ${credit_package_name} - ${creditsToAdd} credits`;
    }

    // 在数据库中创建订单记录
    console.log('Creating order in database:', {
      customer_id: customer.id,
      order_type,
      amount,
      creditsToAdd,
    });
    
    const { data: order, error: orderError } = await supabase
      .from('payment_orders')
      .insert({
        customer_id: customer.id,
        order_type,
        plan_name: order_type === 'subscription' ? plan_name : null,
        credit_package_name: order_type === 'credits' ? credit_package_name : null,
        credits_amount: creditsToAdd,
        amount,
        currency: 'USD',
        status: 'pending',
        metadata: {
          user_id: user.id,
          email: user.email,
        },
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Error creating payment order:', orderError);
      return NextResponse.json(
        { success: false, error: `Failed to create payment order: ${orderError?.message || 'Unknown error'}` },
        { status: 500 }
      );
    }
    console.log('Order created:', order.id);

    // 调用Cream API创建支付订单
    const productId = order_type === 'subscription' && plan_name
      ? SUBSCRIPTION_PLANS[plan_name]?.product_id
      : order_type === 'credits' && credit_package_name
      ? CREDIT_PACKAGES[credit_package_name]?.product_id
      : undefined;
    
    console.log('Calling Cream API:', {
      orderId: order.id,
      amount,
      description,
      productId,
    });
    
    const creemResult = await createCreemOrder(
      order.id,
      amount,
      description,
      {
        order_id: order.id,
        customer_id: customer.id,
        order_type,
        plan_name: order_type === 'subscription' ? plan_name : null,
        credit_package_name: order_type === 'credits' ? credit_package_name : null,
        credits_amount: creditsToAdd,
        product_id: productId,
      }
    );

    console.log('Cream API result:', creemResult);

    if (!creemResult.success) {
      // 如果Cream订单创建失败，更新订单状态
      console.error('Cream order creation failed:', creemResult.error);
      await supabase
        .from('payment_orders')
        .update({ status: 'failed' })
        .eq('id', order.id);

      return NextResponse.json(
        { success: false, error: creemResult.error || 'Failed to create payment order with payment provider' },
        { status: 500 }
      );
    }

    // 更新订单的Cream订单ID
    await supabase
      .from('payment_orders')
      .update({
        creem_order_id: creemResult.creem_order_id,
        status: 'processing',
      })
      .eq('id', order.id);

    return NextResponse.json({
      success: true,
      data: {
        order_id: order.id,
        payment_url: creemResult.payment_url,
        creem_order_id: creemResult.creem_order_id,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/payment/create-order:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

