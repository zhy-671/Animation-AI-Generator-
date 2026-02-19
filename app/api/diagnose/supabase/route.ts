import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/diagnose/supabase
 * 诊断 Supabase 连接状态
 */
export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    checks: [],
    errors: [],
    warnings: [],
  };

  // 1. 检查环境变量
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  diagnostics.checks.push({
    name: "环境变量检查",
    status: supabaseUrl && supabaseAnonKey ? "✅ 通过" : "❌ 失败",
    details: {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : "未设置",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ? `已设置 (${supabaseAnonKey.length} 字符)` : "未设置",
      SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey ? "已设置" : "未设置（可选）",
    },
  });

  if (!supabaseUrl || !supabaseAnonKey) {
    diagnostics.errors.push("环境变量未正确配置");
    return NextResponse.json(diagnostics, { status: 500 });
  }

  // 2. 测试基本 API 连接
  try {
    const apiResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      signal: AbortSignal.timeout(10000), // 10秒超时
    });

    diagnostics.checks.push({
      name: "API 端点连接",
      status: apiResponse.ok ? "✅ 通过" : "⚠️ 异常",
      details: {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
      },
    });
  } catch (error) {
    diagnostics.checks.push({
      name: "API 端点连接",
      status: "❌ 失败",
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    diagnostics.errors.push(`API 连接失败: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 3. 测试认证端点
  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (authResponse.ok) {
      const authData = await authResponse.json().catch(() => ({}));
      diagnostics.checks.push({
        name: "认证服务",
        status: "✅ 通过",
        details: authData,
      });
    } else {
      diagnostics.checks.push({
        name: "认证服务",
        status: "⚠️ 异常",
        details: {
          status: authResponse.status,
          statusText: authResponse.statusText,
        },
      });
    }
  } catch (error) {
    diagnostics.checks.push({
      name: "认证服务",
      status: "❌ 失败",
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    diagnostics.errors.push(`认证服务连接失败: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 4. 测试数据库连接
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 尝试查询一个简单的表
    const { data, error } = await supabase
      .from("anim_storyboard_projects")
      .select("id")
      .limit(1);

    if (error) {
      diagnostics.checks.push({
        name: "数据库连接",
        status: "❌ 失败",
        details: {
          error: error.message,
          code: error.code || "N/A",
          details: error.details || "N/A",
          hint: error.hint || "N/A",
        },
      });
      diagnostics.errors.push(`数据库查询失败: ${error.message}`);
    } else {
      diagnostics.checks.push({
        name: "数据库连接",
        status: "✅ 通过",
        details: {
          queryResult: data ? "成功（返回数据）" : "成功（无数据）",
          rowCount: data?.length || 0,
        },
      });
    }
  } catch (error) {
    diagnostics.checks.push({
      name: "数据库连接",
      status: "❌ 失败",
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    diagnostics.errors.push(`数据库连接失败: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 5. 网络诊断
  try {
    const url = new URL(supabaseUrl);
    diagnostics.checks.push({
      name: "网络配置",
      status: "✅ 通过",
      details: {
        hostname: url.hostname,
        protocol: url.protocol,
        port: url.port || "默认",
      },
    });
  } catch (error) {
    diagnostics.warnings.push(`URL 解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 6. 检查 Supabase 客户端创建
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const client = await createClient();
    diagnostics.checks.push({
      name: "Supabase 客户端创建",
      status: "✅ 通过",
      details: {
        clientType: "server",
      },
    });
  } catch (error) {
    diagnostics.checks.push({
      name: "Supabase 客户端创建",
      status: "❌ 失败",
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    diagnostics.errors.push(`客户端创建失败: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 总结
  diagnostics.summary = {
    totalChecks: diagnostics.checks.length,
    passed: diagnostics.checks.filter((c: any) => c.status.includes("✅")).length,
    failed: diagnostics.checks.filter((c: any) => c.status.includes("❌")).length,
    warnings: diagnostics.checks.filter((c: any) => c.status.includes("⚠️")).length,
    overallStatus: diagnostics.errors.length === 0 ? "✅ 正常" : "❌ 异常",
  };

  return NextResponse.json(diagnostics, {
    status: diagnostics.errors.length === 0 ? 200 : 500,
  });
}

