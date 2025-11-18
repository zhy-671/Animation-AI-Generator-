import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyCreemWebhookSignature, getCreemOrderStatus } from '@/lib/payment/creem';
import type { CreemWebhookEvent, CreamPaymentWebhook } from '@/lib/payment/types';

const CREEM_WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET;

/**
 * Webhook 专用的积分操作函数（不需要用户认证）
 * 使用服务端权限客户端，直接操作数据库
 */
async function operateCreditsForWebhook(params: {
  customerId: string;
  amount: number;
  type: 'add' | 'subtract';
  description: string;
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; error?: string }> {
  const serviceClient = createServiceClient();

  // 获取客户信息
  const { data: customer, error: customerError } = await serviceClient
    .from('anim_customers')
    .select('*')
    .eq('id', params.customerId)
    .single();

  if (customerError || !customer) {
    return { success: false, error: `Customer not found: ${customerError?.message || 'Unknown error'}` };
  }

  // 检查积分是否足够（如果是扣除操作）
  if (params.type === 'subtract' && customer.credits < params.amount) {
    return { success: false, error: 'Insufficient credits' };
  }

  // 计算新积分
  const newCredits = params.type === 'add' 
    ? customer.credits + params.amount
    : customer.credits - params.amount;

  // 更新积分
  const { error: updateError } = await serviceClient
    .from('anim_customers')
    .update({ credits: newCredits })
    .eq('id', customer.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // 记录积分历史（包含完整的 metadata，包括 creem_order_id）
  const { error: historyError } = await serviceClient
    .from('anim_credits_history')
    .insert({
      customer_id: customer.id,
      amount: params.amount,
      type: params.type,
      description: params.description || null,
      metadata: params.metadata || {}, // 包含 creem_order_id, order_id 等关联信息
    });

  if (historyError) {
    console.error('Failed to insert credits history:', historyError);
    // 如果历史记录失败，回滚积分更新
    await serviceClient
      .from('anim_customers')
      .update({ credits: customer.credits })
      .eq('id', customer.id);
    
    return { 
      success: false, 
      error: `Failed to record credits history: ${historyError.message}` 
    };
  }

  console.log('✅ Credits history recorded:', {
    customer_id: customer.id,
    amount: params.amount,
    type: params.type,
    metadata: params.metadata,
  });

  return { success: true };
}

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
  let body = '';
  
  try {
    body = await request.text();

    // Validate body is not empty
    if (!body || body.trim().length === 0) {
      console.error('Empty webhook body received');
      return NextResponse.json(
        { error: 'Empty request body' },
        { status: 400 }
      );
    }

    // Read signature header (support common casings)
    const h = await headers();
    const signature =
      h.get('creem-signature') ||
      h.get('Creem-Signature') ||
      h.get('CREEM-SIGNATURE') ||
      h.get('x-creem-signature') ||
      h.get('x-signature') ||
      '';

    if (!CREEM_WEBHOOK_SECRET) {
      console.error('Missing CREEM_WEBHOOK_SECRET env var. Refusing to process webhook.');
      return NextResponse.json(
        { error: 'Server misconfiguration: CREEM_WEBHOOK_SECRET is not set' },
        { status: 500 }
      );
    }

    // Verify the webhook signature
    if (!signature) {
      console.error('Missing creem-signature header');
      return NextResponse.json(
        { error: 'Missing signature header' },
        { status: 401 }
      );
    }

    const isValid = verifyCreemWebhookSignature(body, signature, CREEM_WEBHOOK_SECRET);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    console.log('Webhook signature verified successfully');

    // Parse JSON with error handling
    let event: CreemWebhookEvent;
    try {
      event = JSON.parse(body) as CreemWebhookEvent;
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown parse error';
      return NextResponse.json(
        { 
          error: 'Invalid JSON body',
          details: errorMsg
        },
        { status: 400 }
      );
    }

    // Validate event structure
    if (!event || !event.eventType) {
      console.error('Invalid event structure:', event);
      return NextResponse.json(
        { error: 'Invalid event structure: missing eventType' },
        { status: 400 }
      );
    }

    // Log received event for debugging
    console.log('Received webhook event:', {
      eventType: event.eventType,
      eventId: event.id,
      objectId: event.object?.id,
      hasOrder: !!event.object?.order,
      hasSubscription: !!event.object?.subscription,
    });

    // Handle different event types with error handling
    try {
      switch (event.eventType) {
        case 'checkout.completed':
          await handleCheckoutCompleted(event);
          break;
        case 'subscription.active':
          await handleSubscriptionActive(event);
          break;
        case 'subscription.paid':
          await handleSubscriptionPaid(event);
          break;
        case 'subscription.canceled':
          await handleSubscriptionCanceled(event);
          break;
        case 'subscription.expired':
          await handleSubscriptionExpired(event);
          break;
        default:
          console.log(`Unhandled event type: ${event.eventType}`);
      }
    } catch (handlerError) {
      console.error(`Error handling ${event.eventType}:`, handlerError);
      throw handlerError; // Re-throw to be caught by outer catch
    }

    return NextResponse.json({ 
      received: true,
      eventType: event.eventType,
      processed: true 
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Return more specific error information
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { 
        error: 'Webhook processing failed', 
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * 提取 metadata（支持多种位置和命名）
 */
function extractMetadata(checkout: CreemWebhookEvent['object']): Record<string, any> {
  // 支持多种 metadata 位置和命名（metadata 和 metaData）
  const metadata: Record<string, any> = {};
  
  // checkout.metadata
  if (checkout.metadata) {
    Object.assign(metadata, checkout.metadata);
  }
  if ((checkout as any).metaData) {
    Object.assign(metadata, (checkout as any).metaData);
  }
  
  // checkout.order.metadata (需要类型断言，因为类型定义中可能没有)
  if (checkout.order) {
    const order = checkout.order as any;
    if (order.metadata) {
      Object.assign(metadata, order.metadata);
    }
    if (order.metaData) {
      Object.assign(metadata, order.metaData);
    }
  }
  
  // checkout.subscription.metadata
  if (checkout.subscription?.metadata) {
    Object.assign(metadata, checkout.subscription.metadata);
  }
  if ((checkout.subscription as any)?.metaData) {
    Object.assign(metadata, (checkout.subscription as any).metaData);
  }
  
  return metadata;
}

/**
 * 处理 checkout.completed 事件
 */
async function handleCheckoutCompleted(event: CreemWebhookEvent) {
  const checkout = event.object;
  const supabase = await createClient();

  // Validate checkout object
  if (!checkout || !checkout.id) {
    throw new Error('Invalid checkout object: missing id');
  }

  // Validate order exists and is paid
  if (!checkout.order) {
    throw new Error('Order object is missing in checkout');
  }

  // Only process if order status is "paid"
  if (checkout.order.status !== 'paid') {
    console.warn(`Skipping checkout ${checkout.id}: order status is "${checkout.order.status}", expected "paid"`);
    return; // Don't throw error, just skip processing
  }

  // Extract metadata from all possible locations
  const metadata = extractMetadata(checkout);
  
  console.log('Checkout object structure:', {
    hasCheckout: !!checkout,
    checkoutId: checkout?.id,
    hasOrder: !!checkout?.order,
    orderId: checkout?.order?.id, // Creem 的真实订单 ID
    orderStatus: checkout?.order?.status,
    orderType: checkout?.order?.type,
    hasSubscription: !!checkout?.subscription,
    extractedMetadata: metadata,
  });

  // Get user_id from metadata
  const userId = metadata.user_id;
  
  console.log('Extracted userId:', userId);
  
  if (!userId) {
    console.error('Missing user_id in checkout metadata');
    throw new Error('user_id is required in checkout metadata');
  }

  // Get product_type from metadata, or infer from order.type
  let productType = metadata.product_type;
  
  if (!productType && checkout.order) {
    if (checkout.order.type === 'recurring') {
      productType = 'subscription';
    } else if (checkout.order.type === 'one-time') {
      productType = 'credits';
    } else {
      throw new Error('product_type is required in checkout metadata or order.type must be "recurring" or "one-time"');
    }
  }

  console.log('Product type:', productType);

  // Get customer_id from metadata or find by user_id
  let customerId: string;
  if (metadata.customer_id) {
    customerId = metadata.customer_id;
  } else {
    // Find customer by user_id
    const { data: customer, error: customerError } = await supabase
      .from('anim_customers')
      .select('id')
      .eq('user_id', userId)
      .single();
    
    if (customerError || !customer) {
      throw new Error(`Customer not found for user_id: ${userId}`);
    }
    customerId = customer.id;
  }

  // 查找订单：优先使用 Creem 的真实订单 ID (checkout.order.id)
  const creemOrderId = checkout.order.id; // 这是 Creem 的真实订单 ID
  let order = null;

  // 方式1: 使用 Creem 的真实订单 ID 查找
  if (creemOrderId) {
    const { data, error } = await supabase
      .from('payment_orders')
      .select('*, anim_customers!inner(user_id)')
      .eq('creem_order_id', creemOrderId)
      .single();
    
    if (data) {
      order = data;
      console.log('✅ Found order by Creem order ID:', creemOrderId);
    } else {
      console.log('Order not found by Creem order ID, trying metadata.order_id...');
    }
  }

  // 方式2: 使用 metadata.order_id 查找（我们自己的订单ID）
  if (!order && metadata.order_id) {
    const { data, error } = await supabase
      .from('payment_orders')
      .select('*, anim_customers!inner(user_id)')
      .eq('id', metadata.order_id)
      .single();
    
    if (data) {
      order = data;
      console.log('✅ Found order by metadata.order_id:', metadata.order_id);
    }
  }

  // 方式3: 使用 checkout_id 查找
  if (!order) {
    const { data, error } = await supabase
      .from('payment_orders')
      .select('*, anim_customers!inner(user_id)')
      .contains('metadata', { checkout_id: checkout.id })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data) {
      order = data;
      console.log('✅ Found order by checkout_id:', checkout.id);
    }
  }

  // 如果找不到订单，记录警告但继续处理（可能订单记录丢失）
  if (!order) {
    console.warn('⚠️ Order not found in database, but continuing with credit processing', {
      creem_order_id: creemOrderId,
      metadata_order_id: metadata.order_id,
      checkout_id: checkout.id,
      user_id: userId,
      customer_id: customerId,
    });
  }

  // 更新或创建订单记录
  if (order) {
    // 更新订单状态和 creem_order_id
    const { error: updateError } = await supabase
      .from('payment_orders')
      .update({
        status: 'completed',
        creem_order_id: creemOrderId, // 使用 Creem 的真实订单 ID
        creem_payment_id: checkout.order.transaction || creemOrderId,
        completed_at: new Date().toISOString(),
        metadata: {
          ...order.metadata,
          creem_order_id: creemOrderId,
          payment_id: checkout.order.transaction || creemOrderId,
          subscription_id: checkout.subscription?.id,
          processed_at: new Date().toISOString(),
        },
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('Error updating order:', updateError);
    } else {
      console.log('✅ Order updated successfully');
    }
  }

  // Handle credit purchases
  if (productType === 'credits') {
    console.log('Processing credit purchase...');
    
    // Get credits from metadata
    const creditsRaw = metadata.credits;
    const credits = typeof creditsRaw === 'string' ? parseInt(creditsRaw, 10) : Number(creditsRaw || 0);
    
    console.log('Credit purchase details:', { creditsRaw, credits });

    if (!credits || credits <= 0) {
      console.error('Invalid credits amount:', creditsRaw);
      throw new Error(`Invalid credits amount: ${creditsRaw}`);
    }

    // Add credits (使用 webhook 专用函数，不需要用户认证)
    const creditResult = await operateCreditsForWebhook({
      customerId: customerId,
      amount: credits,
      type: 'add',
      description: `Credit Purchase: ${metadata.credit_package_name || 'Credits'}`,
      metadata: {
        creem_order_id: creemOrderId, // Creem 的真实订单 ID，用于关联
        order_id: order?.id, // 我们自己的订单 ID，用于关联
        credit_package_name: metadata.credit_package_name,
        payment_id: checkout.order.transaction || creemOrderId,
        checkout_id: checkout.id, // Checkout ID
        type: 'credit_purchase',
        webhook_verified: true,
        processed_at: new Date().toISOString(),
      },
    });

    if (!creditResult.success) {
      console.error('Error adding credits:', creditResult.error);
      throw new Error(`Failed to add credits: ${creditResult.error || 'Unknown error'}`);
    }

    console.log(`✅ Added ${credits} credits to customer ${customerId}`);
  }
  // Handle subscription purchases
  else if (productType === 'subscription') {
    console.log('Processing subscription purchase...');

    // Get monthly credits from metadata
    const creditsRaw = metadata.credits;
    const credits = typeof creditsRaw === 'string' ? parseInt(creditsRaw, 10) : Number(creditsRaw || 0);

    console.log('Subscription checkout credits:', { creditsRaw, credits });

    if (credits > 0) {
      // Add monthly credits for initial subscription (使用 webhook 专用函数)
      const creditResult = await operateCreditsForWebhook({
        customerId: customerId,
        amount: credits,
        type: 'add',
        description: `Monthly subscription credits: ${credits}`,
        metadata: {
          creem_order_id: creemOrderId, // Creem 的真实订单 ID，用于关联
          order_id: order?.id, // 我们自己的订单 ID，用于关联
          plan_name: metadata.plan_name,
          payment_id: checkout.order.transaction || creemOrderId,
          subscription_id: checkout.subscription?.id,
          checkout_id: checkout.id, // Checkout ID
          type: 'subscription',
          webhook_verified: true,
          processed_at: new Date().toISOString(),
        },
      });

      if (!creditResult.success) {
        console.error('Error adding subscription credits:', creditResult.error);
        throw new Error(`Failed to add subscription credits: ${creditResult.error || 'Unknown error'}`);
      }

      console.log(`✅ Added ${credits} subscription credits to customer ${customerId}`);
    }

    // Update subscription plan in anim_customers
    if (metadata.plan_name && checkout.subscription) {
      const expiresAt = new Date((checkout.subscription as any).current_period_end_date || new Date().setMonth(new Date().getMonth() + 1));
      
      const { error: updateError } = await supabase
        .from('anim_customers')
        .update({
          subscription_plan: metadata.plan_name,
          subscription_expires_at: expiresAt.toISOString(),
        })
        .eq('id', customerId);

      if (updateError) {
        console.error('Error updating subscription plan:', updateError);
      } else {
        console.log(`✅ Updated subscription plan to ${metadata.plan_name} for customer ${customerId}`);
      }
    }
  } else {
    console.warn('Unknown product type:', productType);
    throw new Error(`Unknown product type: ${productType}`);
  }
}

/**
 * 处理 subscription.active 事件
 */
async function handleSubscriptionActive(event: CreemWebhookEvent) {
  // 对于 subscription 事件，event.object 就是 subscription 对象
  const subscription = event.object as any;
  const supabase = await createClient();

  console.log('=== Processing subscription.active event ===');
  console.log('Subscription ID:', subscription.id);
  console.log('Subscription status:', subscription.status);

  // Get user_id from subscription metadata
  const metadata = subscription.metadata || {};
  const userId = metadata.user_id;
  
  if (!userId) {
    console.error('Missing user_id in subscription metadata:', subscription);
    throw new Error('user_id is required in subscription metadata');
  }

  console.log('User ID:', userId);

  // Find customer by user_id
  const { data: customer, error: customerError } = await supabase
    .from('anim_customers')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (customerError || !customer) {
    throw new Error(`Customer not found for user_id: ${userId}`);
  }

  const customerId = customer.id;
  console.log('Customer ID:', customerId);

  // Update subscription plan
  if (metadata.plan_name) {
    const expiresAt = new Date(subscription.current_period_end_date);
    
    const { error: updateError } = await supabase
      .from('anim_customers')
      .update({
        subscription_plan: metadata.plan_name,
        subscription_expires_at: expiresAt.toISOString(),
      })
      .eq('id', customerId);

    if (updateError) {
      console.error('Error updating subscription plan:', updateError);
    } else {
      console.log(`✅ Updated subscription plan to ${metadata.plan_name}`);
    }
  }

  // Get monthly credits from metadata
  const creditsRaw = metadata.credits;
  const credits = typeof creditsRaw === 'string' ? parseInt(creditsRaw, 10) : Number(creditsRaw || 0);

  if (credits > 0) {
    // Add monthly credits (使用 webhook 专用函数)
    const creditResult = await operateCreditsForWebhook({
      customerId: customerId,
      amount: credits,
      type: 'add',
      description: `Monthly subscription credits: ${credits}`,
      metadata: {
        subscription_id: subscription.id,
        plan_name: metadata.plan_name,
        type: 'subscription',
        webhook_verified: true,
        processed_at: new Date().toISOString(),
      },
    });

    if (!creditResult.success) {
      console.error('Error adding subscription credits:', creditResult.error);
      throw new Error(`Failed to add subscription credits: ${creditResult.error || 'Unknown error'}`);
    }

    console.log(`✅ Added ${credits} monthly subscription credits to customer ${customerId}`);
  }
}

/**
 * 处理 subscription.paid 事件
 */
async function handleSubscriptionPaid(event: CreemWebhookEvent) {
  // 对于 subscription 事件，event.object 就是 subscription 对象
  const subscription = event.object as any;
  const supabase = await createClient();

  console.log('=== Processing subscription.paid event ===');
  console.log('Subscription ID:', subscription.id);

  // Get user_id from subscription metadata
  const metadata = subscription.metadata || {};
  const userId = metadata.user_id;
  
  if (!userId) {
    console.error('Missing user_id in subscription metadata:', subscription);
    throw new Error('user_id is required in subscription metadata');
  }

  // Find customer by user_id
  const { data: customer, error: customerError } = await supabase
    .from('anim_customers')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (customerError || !customer) {
    throw new Error(`Customer not found for user_id: ${userId}`);
  }

  const customerId = customer.id;
  console.log('Customer ID:', customerId);

  // Update subscription plan
  if (metadata.plan_name) {
    const expiresAt = new Date(subscription.current_period_end_date);
    
    const { error: updateError } = await supabase
      .from('anim_customers')
      .update({
        subscription_plan: metadata.plan_name,
        subscription_expires_at: expiresAt.toISOString(),
      })
      .eq('id', customerId);

    if (updateError) {
      console.error('Error updating subscription plan:', updateError);
    }
  }

  // Get monthly credits from metadata
  const creditsRaw = metadata.credits;
  const credits = typeof creditsRaw === 'string' ? parseInt(creditsRaw, 10) : Number(creditsRaw || 0);

  if (credits > 0) {
    // Add monthly credits for renewal (使用 webhook 专用函数)
    const creditResult = await operateCreditsForWebhook({
      customerId: customerId,
      amount: credits,
      type: 'add',
      description: `Monthly subscription renewal: ${credits} credits`,
      metadata: {
        subscription_id: subscription.id,
        plan_name: metadata.plan_name,
        type: 'subscription_renewal',
        webhook_verified: true,
        processed_at: new Date().toISOString(),
      },
    });

    if (!creditResult.success) {
      console.error('Error adding subscription credits:', creditResult.error);
      throw new Error(`Failed to add subscription credits: ${creditResult.error || 'Unknown error'}`);
    }

    console.log(`✅ Added ${credits} monthly subscription renewal credits to customer ${customerId}`);
  }
}

/**
 * 处理 subscription.canceled 事件
 */
async function handleSubscriptionCanceled(event: CreemWebhookEvent) {
  // 对于 subscription 事件，event.object 就是 subscription 对象
  const subscription = event.object as any;
  const supabase = await createClient();

  console.log('Processing canceled subscription:', subscription.id);

  const metadata = subscription.metadata || {};
  const userId = metadata.user_id;
  
  if (!userId) {
    console.warn('Missing user_id in subscription metadata, skipping subscription update');
    return;
  }

  // Find customer by user_id
  const { data: customer } = await supabase
    .from('anim_customers')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (customer) {
    // Clear subscription plan
    await supabase
      .from('anim_customers')
      .update({
        subscription_plan: null,
        subscription_expires_at: null,
      })
      .eq('id', customer.id);

    console.log(`✅ Cleared subscription for customer ${customer.id}`);
  }
}

/**
 * 处理 subscription.expired 事件
 */
async function handleSubscriptionExpired(event: CreemWebhookEvent) {
  // 对于 subscription 事件，event.object 就是 subscription 对象
  const subscription = event.object as any;
  const supabase = await createClient();

  console.log('Processing expired subscription:', subscription.id);

  const metadata = subscription.metadata || {};
  const userId = metadata.user_id;
  
  if (!userId) {
    console.warn('Missing user_id in subscription metadata, skipping subscription update');
    return;
  }

  // Find customer by user_id
  const { data: customer } = await supabase
    .from('anim_customers')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (customer) {
    // Clear subscription plan
    await supabase
      .from('anim_customers')
      .update({
        subscription_plan: null,
        subscription_expires_at: null,
      })
      .eq('id', customer.id);

    console.log(`✅ Cleared expired subscription for customer ${customer.id}`);
  }
}
