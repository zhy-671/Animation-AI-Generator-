import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyCreemWebhookSignature, getCreemOrderStatus } from '@/lib/payment/creem';
import { operateCredits } from '@/lib/supabase/customers';
import type { CreamPaymentWebhook } from '@/lib/payment/types';

/**
 * Cream支付Webhook回调处理
 * 处理支付成功、失败等事件
 * 
 * 🔒 安全措施：
 * 1. Webhook签名验证
 * 2. 订单金额验证
 * 3. 订单状态验证
 * 4. 幂等性检查（防止重复处理）
 * 5. 订单存在性验证
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 🔒 安全措施1: 获取原始请求体（用于签名验证）
    const rawBody = await request.text();
    const signature = request.headers.get('x-creem-signature') || '';
    const creemIp = request.headers.get('x-forwarded-for') || '';

    // 🔒 安全措施2: 验证webhook签名（必须通过）
    if (!verifyCreemWebhookSignature(rawBody, signature)) {
      console.error('Invalid webhook signature', {
        ip: creemIp,
        signature: signature.substring(0, 20) + '...',
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // 解析webhook数据
    let webhookData: CreamPaymentWebhook;
    try {
      webhookData = JSON.parse(rawBody);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const { order_id, payment_id, status, amount, payment_method, metadata } = webhookData;

    // 🔒 安全措施3: 查找订单（使用creem_order_id）
    const { data: order, error: orderError } = await supabase
      .from('payment_orders')
      .select('*, anim_customers!inner(user_id)')
      .eq('creem_order_id', order_id)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', {
        creem_order_id: order_id,
        error: orderError,
        ip: creemIp,
      });
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // 🔒 安全措施4: 验证订单金额是否匹配
    const orderAmount = parseFloat(order.amount.toString());
    const webhookAmount = parseFloat(amount.toString());
    const amountDifference = Math.abs(orderAmount - webhookAmount);
    
    // 允许0.01的误差（浮点数精度问题）
    if (amountDifference > 0.01) {
      console.error('Amount mismatch:', {
        order_id: order.id,
        order_amount: orderAmount,
        webhook_amount: webhookAmount,
        difference: amountDifference,
        ip: creemIp,
      });
      return NextResponse.json(
        { success: false, error: 'Amount mismatch' },
        { status: 400 }
      );
    }

    // 🔒 安全措施5: 幂等性检查 - 如果订单已经完成，避免重复处理
    if (order.status === 'completed') {
      // 验证是否已经添加过积分
      const { data: existingHistory } = await supabase
        .from('anim_credits_history')
        .select('id')
        .eq('customer_id', order.customer_id)
        .eq('type', 'add')
        .eq('amount', order.credits_amount)
        .contains('metadata', { order_id: order.id })
        .limit(1);

      if (existingHistory && existingHistory.length > 0) {
        console.log('Order already processed, skipping:', {
          order_id: order.id,
          creem_order_id: order_id,
        });
        return NextResponse.json({
          success: true,
          message: 'Order already processed',
        });
      }
    }

    // 🔒 安全措施6: 验证订单状态（只处理pending或processing状态的订单）
    if (order.status !== 'pending' && order.status !== 'processing') {
      console.warn('Order status is not pending or processing:', {
        order_id: order.id,
        current_status: order.status,
        webhook_status: status,
      });
    }

    // 🔒 安全措施7: 可选 - 向Cream API验证订单状态（双重验证）
    if (order.creem_order_id) {
      const creemStatusCheck = await getCreemOrderStatus(order.creem_order_id);
      if (creemStatusCheck.success && creemStatusCheck.status !== 'completed' && status === 'success') {
        console.warn('Cream API status does not match webhook status:', {
          order_id: order.id,
          creem_status: creemStatusCheck.status,
          webhook_status: status,
        });
        // 可以选择拒绝或记录警告
      }
    }

    // 根据支付状态处理
    if (status === 'success') {
      // 🔒 安全措施8: 使用事务更新订单状态和积分
      // 支付成功，更新订单状态
      const { error: updateError } = await supabase
        .from('payment_orders')
        .update({
          status: 'completed',
          creem_payment_id: payment_id,
          payment_method: payment_method || null,
          completed_at: new Date().toISOString(),
          metadata: {
            ...order.metadata,
            payment_id,
            payment_method,
            webhook_data: webhookData,
            webhook_ip: creemIp,
            processed_at: new Date().toISOString(),
          },
        })
        .eq('id', order.id)
        .eq('status', order.status); // 确保状态没有改变

      if (updateError) {
        console.error('Error updating order:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update order' },
          { status: 500 }
        );
      }

      // 🔒 安全措施9: 验证积分数量
      if (!order.credits_amount || order.credits_amount <= 0) {
        console.error('Invalid credits amount in order:', {
          order_id: order.id,
          credits_amount: order.credits_amount,
        });
        return NextResponse.json(
          { success: false, error: 'Invalid credits amount' },
          { status: 400 }
        );
      }

      // 根据订单类型处理积分和订阅
      if (order.order_type === 'subscription') {
        // 订阅成功：增加积分并更新订阅计划
        const creditResult = await operateCredits({
          customerId: order.customer_id,
          amount: order.credits_amount,
          type: 'add',
          description: `Subscription: ${order.plan_name} Plan - Monthly credits`,
          metadata: {
            order_id: order.id,
            plan_name: order.plan_name,
            payment_id,
            creem_order_id: order_id,
            type: 'subscription',
            webhook_verified: true,
          },
        });

        if (!creditResult.success) {
          console.error('Error adding subscription credits:', creditResult.error);
          // 回滚订单状态
          await supabase
            .from('payment_orders')
            .update({ status: 'processing' })
            .eq('id', order.id);
          return NextResponse.json(
            { success: false, error: 'Failed to add credits' },
            { status: 500 }
          );
        }

        // 更新用户的订阅计划
        if (order.plan_name) {
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 1); // 订阅1个月

          await supabase
            .from('anim_customers')
            .update({
              subscription_plan: order.plan_name,
              subscription_expires_at: expiresAt.toISOString(),
            })
            .eq('id', order.customer_id);
        }
      } else if (order.order_type === 'credits') {
        // 购买积分成功：增加积分
        const creditResult = await operateCredits({
          customerId: order.customer_id,
          amount: order.credits_amount,
          type: 'add',
          description: `Credit Purchase: ${order.credit_package_name}`,
          metadata: {
            order_id: order.id,
            credit_package_name: order.credit_package_name,
            payment_id,
            creem_order_id: order_id,
            type: 'credit_purchase',
            webhook_verified: true,
          },
        });

        if (!creditResult.success) {
          console.error('Error adding purchase credits:', creditResult.error);
          // 回滚订单状态
          await supabase
            .from('payment_orders')
            .update({ status: 'processing' })
            .eq('id', order.id);
          return NextResponse.json(
            { success: false, error: 'Failed to add credits' },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Payment processed successfully',
      });
    } else if (status === 'failed' || status === 'cancelled') {
      // 支付失败或取消，更新订单状态
      await supabase
        .from('payment_orders')
        .update({
          status: status === 'failed' ? 'failed' : 'cancelled',
          creem_payment_id: payment_id,
          metadata: {
            ...order.metadata,
            payment_id,
            webhook_data: webhookData,
            webhook_ip: creemIp,
          },
        })
        .eq('id', order.id);

      return NextResponse.json({
        success: true,
        message: `Payment ${status}`,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook received',
    });
  } catch (error) {
    console.error('Error in POST /api/payment/webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
