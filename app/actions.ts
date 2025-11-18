"use server";

import { encodedRedirect } from "@/lib/utils/utils";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const signUpAction = async (formData: FormData) => {
  try {
    const email = formData.get("email")?.toString();
    const password = formData.get("password")?.toString();
    const redirectTo = formData.get("redirect_to")?.toString();
    
    let supabase;
    try {
      supabase = await createClient();
    } catch (clientError) {
      console.warn("[Auth] Failed to create client with cookies, using fallback:", clientError);
      const { createServerClient } = await import("@supabase/ssr");
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll: () => [],
            setAll: () => {},
          },
        }
      );
    }
    
    const origin = (await headers()).get("origin") || process.env.NEXT_PUBLIC_SITE_URL;

    if (!email || !password) {
      return encodedRedirect(
        "error",
        "/sign-up",
        "Email and password are required"
      );
    }

    if (!origin) {
      return encodedRedirect("error", "/sign-up", "Site URL not configured");
    }

    // Build callback URL with redirect_to parameter
    const callbackUrl = new URL(`${origin}/auth/callback`);
    if (redirectTo) {
      callbackUrl.searchParams.set("redirect_to", redirectTo);
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: callbackUrl.toString(),
      },
    });

    if (error) {
      console.error(error.code + " " + error.message);
      return encodedRedirect("error", "/sign-up", error.message);
    } else {
      // If redirect_to is provided, use it; otherwise default to /dashboard
      const finalRedirect = redirectTo || "/dashboard";
      return encodedRedirect("success", finalRedirect, "Thanks for signing up!");
    }
  } catch (error) {
    console.error("[Auth] Unexpected error in signUpAction:", error);
    return encodedRedirect("error", "/sign-up", error instanceof Error ? error.message : "An unexpected error occurred");
  }
};

export const signInAction = async (formData: FormData) => {
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    
    let supabase;
    try {
      supabase = await createClient();
    } catch (clientError) {
      console.warn("[Auth] Failed to create client with cookies, using fallback:", clientError);
      const { createServerClient } = await import("@supabase/ssr");
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll: () => [],
            setAll: () => {},
          },
        }
      );
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return encodedRedirect("error", "/login", error.message);
    }

    return redirect("/dashboard");
  } catch (error) {
    console.error("[Auth] Unexpected error in signInAction:", error);
    return encodedRedirect("error", "/login", error instanceof Error ? error.message : "An unexpected error occurred");
  }
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin") || process.env.NEXT_PUBLIC_SITE_URL;
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  if (!origin) {
    return encodedRedirect("error", "/forgot-password", "Site URL not configured");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/dashboard/reset-password`,
  });

  if (error) {
    console.error(error.message);
    return encodedRedirect(
      "error",
      "/forgot-password",
      "Could not reset password"
    );
  }

  if (callbackUrl) {
    return redirect(callbackUrl);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "Check your email for a link to reset your password."
  );
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Password and confirm password are required"
    );
  }

  if (password !== confirmPassword) {
    encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Passwords do not match"
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Password update failed"
    );
  }

  encodedRedirect("success", "/dashboard/reset-password", "Password updated");
};

export const signOutAction = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/login");
};

export async function createCheckoutSession(
  productId: string,
  email: string,
  userId: string,
  productType: "subscription" | "credits",
  credits_amount?: number,
  discountCode?: string
) {
  try {
    const requestBody: any = {
      product_id: productId,
      // request_id: `${userId}-${Date.now()}`, // use Unique request ID if you need
      customer: {
        email: email,
      },
      metadata: {
        user_id: userId,
        product_type: productType,
        credits: credits_amount || 0,
      },
    };

    // 如果配置了成功重定向 URL，则添加到请求中
    if (process.env.CREEM_SUCCESS_URL) {
      requestBody.success_url = process.env.CREEM_SUCCESS_URL;
    }

    // 添加折扣码（如果有）
    if (discountCode) {
      requestBody.discount_code = discountCode;
    }

    const response = await fetch(process.env.CREEM_API_URL + "/checkouts", {
      method: "POST",
      headers: {
        "x-api-key": process.env.CREEM_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error("Failed to create checkout session");
    }

    const data = await response.json();
    return data.checkout_url;
  } catch (error) {
    console.error("Error creating checkout session:", error);
    throw error;
  }
}
