import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * 获取当前用户
 * 如果用户未登录，返回 null
 */
export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

/**
 * 要求用户必须登录
 * 如果用户未登录，重定向到登录页面
 */
export async function requireAuth() {
  const user = await getUser()
  
  if (!user) {
    redirect('/login')
  }

  return user
}

/**
 * 获取用户会话
 */
export async function getSession() {
  const supabase = await createClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error || !session) {
    return null
  }

  return session
}

