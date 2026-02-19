import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCustomer } from "@/lib/supabase/customers";
import { CREDIT_PACKAGES, CREEM_CONFIG } from "@/lib/payment/config";

// 使用 CREEM_CONFIG 中的配置，支持 CREEM_API_URL 或 CREEM_BASE_URL
const CREEM_API_URL = CREEM_CONFIG.apiUrl;
const CREEM_API_KEY = CREEM_CONFIG.apiKey;

type Body = {
  packageName?: string; // 包名称
  productId?: string; // 可选：直接提供产品ID（向后兼容）
  credits?: number; // 可选：直接提供积分数量
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!CREEM_API_URL || !CREEM_API_KEY || CREEM_API_URL.trim() === '' || CREEM_API_KEY.trim() === '') {
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
    const { packageName, productId: providedProductId, credits: providedCredits } = body;

    // 如果提供了 packageName，从配置中获取 product_id、credits 和 price
    let productId: string;
    let credits: number;
    let amount: number;
    
    if (packageName) {
      const packageInfo = CREDIT_PACKAGES[packageName];
      if (!packageInfo) {
        return NextResponse.json({ error: `Credit package "${packageName}" not found` }, { status: 400 });
      }
      if (!packageInfo.product_id || packageInfo.product_id.trim() === '') {
        const envVarName = `CREEM_PRODUCT_ID_${packageName.toUpperCase().replace(/\s+/g, '_')}`;
        return NextResponse.json({ 
          error: `Product ID not configured for ${packageName} package. Please set ${envVarName} in your .env.local file and restart the development server.` 
        }, { status: 500 });
      }
      productId = packageInfo.product_id;
      credits = providedCredits ?? packageInfo.credits;
      amount = packageInfo.price;
    } else if (providedProductId) {
      // 向后兼容：如果直接提供了 productId
      productId = providedProductId;
      credits = providedCredits ?? 0;
      amount = 0; // 无法确定价格
      if (!credits) {
        return NextResponse.json({ error: "Missing credits" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Missing packageName or productId" }, { status: 400 });
    }

    // 先在数据库中创建订单记录
    const { data: order, error: orderError } = await supabase
      .from('payment_orders')
      .insert({
        customer_id: customer.id,
        order_type: 'credits',
        credit_package_name: packageName || null,
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
      return NextResponse.json({ 
        error: `Failed to create payment order: ${orderError?.message || 'Unknown error'}` 
      }, { status: 500 });
    }
    // 确保 order.id 存在且是字符串
    if (!order.id) {
      return NextResponse.json({ 
        error: 'Failed to get order ID after creation' 
      }, { status: 500 });
    }

    const orderIdString = String(order.id);
    const payload: any = {
      product_id: productId,
      metadata: {
        user_id: user.id,
        order_id: orderIdString, // 确保是字符串格式
        customer_id: customer.id,
        product_type: "credits",
        credit_package_name: packageName,
        credits,
        product_id: productId, // Add product_id to metadata for bonus calculation
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
      return NextResponse.json({ error: text || "Failed to create checkout" }, { status: 500 });
    }

    const data = await res.json();
    const checkoutUrl = data?.checkout_url || data?.url;
    const checkoutId = data?.id; // Creem checkout ID
    
    // 注意：此时 Creem 还没有创建订单，订单是在支付完成后才创建的
    // 所以这里只能保存 checkout_id，真正的 creem_order_id 会在 webhook 中更新
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
      } else {
      }
    }

    return NextResponse.json({ checkoutUrl });
  } catch (e) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}


