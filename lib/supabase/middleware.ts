import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // 跳过静态文件和 API 路由
  const pathname = request.nextUrl.pathname
  
  // 如果是静态文件（图片、视频、字体等），直接返回
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|mp4|webm|ogg|mp3|wav|pdf|ico|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            // Configure cookies for main domain
            // All requests use the main domain (videoaimusic.com)
            // we need sameSite: 'none' and secure: true
            const cookieOptions = {
              ...options,
              domain: process.env.NODE_ENV === 'production' ? '.videoaimusic.com' : undefined,
              sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax' | 'strict',
              secure: process.env.NODE_ENV === 'production',
              path: '/',
            }
            supabaseResponse.cookies.set(name, value, cookieOptions)
          })
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // 更新用户会话（但不强制要求登录）
  // 所有页面都可以公开访问，无需登录
  await supabase.auth.getUser()

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely.

  return supabaseResponse
}

