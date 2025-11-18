import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCustomer } from "@/lib/supabase/customers";
import { SUBSCRIPTION_PLANS, CREEM_CONFIG } from "@/lib/payment/config";

// 使用 CREEM_CONFIG 中的配置，支持 CREEM_API_URL 或 CREEM_BASE_URL
const CREEM_API_URL = CREEM_CONFIG.apiUrl;
const CREEM_API_KEY = CREEM_CONFIG.apiKey;

type Body = {
  planName?: 'basic' | 'pro' | 'studio'; // 计划名称
  productId?: string; // 可选：直接提供产品ID（向后兼容）
  credits?: number; // Monthly credits for the subscription
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!CREEM_API_URL || !CREEM_API_KEY || CREEM_API_URL.trim() === '' || CREEM_API_KEY.trim() === '') {
      console.error('Creem API not configured:', {
        hasApiUrl: !!CREEM_API_URL,
        hasApiKey: !!CREEM_API_KEY,
        apiUrlLength: CREEM_API_URL?.length || 0,
        apiKeyLength: CREEM_API_KEY?.length || 0,
      });
      return NextResponse.json({ 
        error: "Creem API not configured. Please set CREEM_API_URL (or CREEM_BASE_URL) and CREEM_API_KEY in your .env.local file and restart the development server." 
      }, { status: 500 });
    }

    // 获取客户信息
    const customer = await getCurrentCustomer();
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const body = (await req.json()) as Body;
    const { planName, productId: providedProductId, credits: providedCredits } = body;

    // 如果提供了 planName，从配置中获取 product_id、credits 和 price
    let productId: string;
    let credits: number;
    let amount: number;
    
    if (planName) {
      const plan = SUBSCRIPTION_PLANS[planName];
      if (!plan) {
        return NextResponse.json({ error: `Subscription plan "${planName}" not found` }, { status: 400 });
      }
      if (!plan.product_id || plan.product_id.trim() === '') {
        return NextResponse.json({ 
          error: `Product ID not configured for ${planName} plan. Please set CREEM_PRODUCT_ID_${planName.toUpperCase()} in your .env.local file and restart the development server.` 
        }, { status: 500 });
      }
      productId = plan.product_id;
      credits = providedCredits ?? plan.credits;
      amount = plan.price;
    } else if (providedProductId) {
      // 向后兼容：如果直接提供了 productId
      productId = providedProductId;
      credits = providedCredits ?? 0;
      amount = 0; // 无法确定价格
    } else {
      return NextResponse.json({ error: "Missing planName or productId" }, { status: 400 });
    }

    // 先在数据库中创建订单记录
    const { data: order, error: orderError } = await supabase
      .from('payment_orders')
      .insert({
        customer_id: customer.id,
        order_type: 'subscription',
        plan_name: planName || null,
        credits_amount: credits,
        amount: amount,
        currency: 'USD',
        status: 'pending',
        metadata: {
          user_id: user.id,
          email: user.email,
          product_id: productId,
        },
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Error creating payment order:', orderError);
      return NextResponse.json({ 
        error: `Failed to create payment order: ${orderError?.message || 'Unknown error'}` 
      }, { status: 500 });
    }

    console.log('✅ Order created successfully:', {
      order_id: order.id,
      order_id_type: typeof order.id,
      order_id_length: order.id?.length,
      customer_id: customer.id,
      plan_name: planName,
      credits: credits,
      amount: amount,
    });

    // 确保 order.id 存在且是字符串
    if (!order.id) {
      console.error('❌ Order ID is missing after creation!');
      return NextResponse.json({ 
        error: 'Failed to get order ID after creation' 
      }, { status: 500 });
    }

    const orderIdString = String(order.id);
    console.log('📤 Sending to Creem with metadata:', {
      order_id: orderIdString,
      user_id: user.id,
      customer_id: customer.id,
      plan_name: planName,
    });

    const payload: any = {
      product_id: productId,
      metadata: {
        user_id: user.id,
        order_id: orderIdString, // 确保是字符串格式
        customer_id: customer.id,
        product_type: "subscription",
        plan_name: planName,
        credits: credits || 0, // Monthly credits
      },
    };

    // Only add success_url if configured in environment variable
    if (process.env.CREEM_SUCCESS_URL) {
      payload.success_url = process.env.CREEM_SUCCESS_URL;
    }

    const res = await fetch(`${CREEM_API_URL}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CREEM_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Creem API call failed:', {
        status: res.status,
        statusText: res.statusText,
        error: text,
        order_id: order.id,
      });
      // 不要删除订单，保留以便调试和后续处理
      // 更新订单状态为 failed，而不是删除
      await supabase
        .from('payment_orders')
        .update({ 
          status: 'failed',
          metadata: {
            ...order.metadata,
            creem_api_error: text,
            creem_api_status: res.status,
          },
        })
        .eq('id', order.id);
      return NextResponse.json({ error: text || "Failed to create subscription checkout" }, { status: 500 });
    }

    const data = await res.json();
    const checkoutUrl = data?.checkout_url || data?.url;
    const checkoutId = data?.id; // Creem checkout ID
    
    // 注意：此时 Creem 还没有创建订单，订单是在支付完成后才创建的
    // 所以这里只能保存 checkout_id，真正的 creem_order_id 会在 webhook 中更新
    console.log('📥 Creem checkout response:', {
      checkout_id: checkoutId,
      checkout_url: checkoutUrl,
      full_response: data,
    });

    // 更新订单记录，保存 Creem checkout ID
    // 真正的 Creem 订单 ID (object.order.id) 会在 webhook 中收到后更新
    if (checkoutId) {
      const { error: updateError } = await supabase
        .from('payment_orders')
        .update({
          creem_order_id: checkoutId, // 暂时保存 checkout_id，webhook 会更新为真正的 order.id
          status: 'processing',
          metadata: {
            ...order.metadata,
            checkout_id: checkoutId,
          },
        })
        .eq('id', order.id);
      
      if (updateError) {
        console.error('Error updating order with checkout_id:', updateError);
      } else {
        console.log('✅ Order updated with checkout_id:', {
          order_id: order.id,
          checkout_id: checkoutId,
        });
      }
    }

    return NextResponse.json({ checkoutUrl });
  } catch (e) {
    console.error("Error creating subscription:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

