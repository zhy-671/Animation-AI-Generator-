import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/payment/order/[orderId]
 * 获取订单信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { orderId } = await params;
    
    // 获取 URL 查询参数，支持通过 checkout_id 查找
    const searchParams = request.nextUrl.searchParams;
    const checkoutId = searchParams.get('checkout_id');

    let order = null;
    let orderError = null;

    // 方式1: 先尝试通过我们自己的订单 ID 查找
    const { data: orderById, error: errorById } = await supabase
      .from("payment_orders")
      .select("*, anim_customers!inner(user_id)")
      .eq("id", orderId)
      .single();

    if (orderById) {
      order = orderById;
    } else {
      // 方式2: 通过 creem_order_id 查找（URL 中的 order_id 可能是 Creem 的订单 ID）
      const { data: orderByCreemId, error: errorByCreemId } = await supabase
        .from("payment_orders")
        .select("*, anim_customers!inner(user_id)")
        .eq("creem_order_id", orderId)
        .single();

      if (orderByCreemId) {
        order = orderByCreemId;
      } else if (checkoutId) {
        // 方式3: 通过 checkout_id 查找（在 metadata 中）
        const { data: orderByCheckoutId, error: errorByCheckoutId } = await supabase
          .from("payment_orders")
          .select("*, anim_customers!inner(user_id)")
          .contains("metadata", { checkout_id: checkoutId })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (orderByCheckoutId) {
          order = orderByCheckoutId;
        } else {
          orderError = errorByCheckoutId;
        }
      } else {
        orderError = errorByCreemId || errorById;
      }
    }

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // 验证订单属于当前用户
    const { data: customer, error: customerError } = await supabase
      .from("anim_customers")
      .select("user_id")
      .eq("id", order.customer_id)
      .single();

    if (customerError || !customer || customer.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        product_type: order.product_type,
        plan_name: order.metadata?.plan_name,
        credits: order.metadata?.credits,
        status: order.status,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get order",
      },
      { status: 500 }
    );
  }
}

