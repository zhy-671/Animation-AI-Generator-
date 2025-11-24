import { createClient } from "@/lib/supabase/server";
import { CREEM_CONFIG } from "@/lib/payment/config";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // Get the user from the session
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get the customer record for this user
    const { data: customer, error: customerError } = await supabase
      .from("anim_customers")
      .select("creem_customer_id")
      .eq("user_id", user.id)
      .single();

    if (customerError || !customer) {
      return new NextResponse("No subscription found", { status: 404 });
    }

    // Call Creem API to get the customer portal link
    if (!CREEM_CONFIG.apiUrl || !CREEM_CONFIG.apiKey) {
      return new NextResponse("Creem API not configured", { status: 500 });
    }

    const response = await fetch(
      `${CREEM_CONFIG.apiUrl}/customers/billing`,
      {
        method: "POST",
        headers: {
          "x-api-key": CREEM_CONFIG.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customer.creem_customer_id,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to get customer portal link");
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
