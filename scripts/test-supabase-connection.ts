/**
 * Supabase 连接诊断脚本
 * 用于检查 Supabase 配置和连接状态
 */

async function testSupabaseConnection() {
  // 1. 检查环境变量
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl) {
  }
  if (supabaseAnonKey) {
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    return;
  }

  // 2. 测试基本连接
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
    });
    if (response.ok) {
    } else {
    }
  } catch (error) {
  }

  // 3. 测试认证端点
  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
      },
    });
    if (authResponse.ok) {
      const data = await authResponse.json();
    } else {
    }
  } catch (error) {
  }

  // 4. 测试数据库连接（使用 Supabase 客户端）
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 尝试一个简单的查询
    const { data, error } = await supabase
      .from('anim_storyboard_projects')
      .select('id')
      .limit(1);

    if (error) {
    } else {
    }
  } catch (error) {
  }

  // 5. 网络诊断
  try {
    const testUrl = new URL(supabaseUrl);
    // 尝试 DNS 解析（通过 ping 测试）
    const dnsTest = await fetch(`https://${testUrl.hostname}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    if (dnsTest) {
    } else {
    }
  } catch (error) {
  }
}

// 运行诊断
testSupabaseConnection().catch(() => {});

