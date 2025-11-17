# Supabase Configuration Guide

## 环境变量设置

在项目根目录创建 `.env.local` 文件，并添加以下内容：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 如何获取 Supabase 凭证

1. 访问 [Supabase Dashboard](https://app.supabase.com/)
2. 创建新项目或选择现有项目
3. 进入项目设置 (Settings) > API
4. 复制以下信息：
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 文件结构

```
lib/
  supabase/
    client.ts      # 客户端 Supabase 客户端（浏览器端使用）
    server.ts      # 服务端 Supabase 客户端（Server Components/API Routes 使用）
    middleware.ts  # 中间件 Supabase 客户端（用于认证中间件）
```

## 使用方法

### 客户端组件中使用

```typescript
'use client'
import { createClient } from '@/lib/supabase/client'

export default function ClientComponent() {
  const supabase = createClient()
  
  // 使用 supabase 客户端
  const { data, error } = await supabase.from('table_name').select('*')
}
```

### 服务端组件中使用

```typescript
import { createClient } from '@/lib/supabase/server'

export default async function ServerComponent() {
  const supabase = await createClient()
  
  // 使用 supabase 客户端
  const { data, error } = await supabase.from('table_name').select('*')
}
```

### API Routes 中使用

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  
  const { data, error } = await supabase.from('table_name').select('*')
  
  return NextResponse.json({ data, error })
}
```

## 认证功能

中间件已配置为自动处理用户会话。未登录用户访问受保护路由时会被重定向到 `/login` 页面。

### 受保护的路由

默认情况下，除了 `/login` 和 `/auth` 路径外，所有路由都需要认证。

如需修改受保护的路由逻辑，请编辑 `lib/supabase/middleware.ts` 文件。

