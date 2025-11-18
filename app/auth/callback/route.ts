import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  let next = requestUrl.searchParams.get('next') || '/'

  // If no next param, try to get from sessionStorage (for client-side redirect)
  // Since this is server-side, we'll use a client-side redirect page
  if (!next || next === '/') {
    // Use a client-side redirect page that reads from sessionStorage
    next = '/auth/callback-redirect'
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // 成功登录，重定向到指定页面或首页
      // If next is the redirect page, it will handle reading from sessionStorage
      return redirect(next)
    }
  }

  // 如果出错或没有 code，重定向到登录页
  return redirect('/login')
}

