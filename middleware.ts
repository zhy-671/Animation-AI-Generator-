import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const protocol = request.nextUrl.protocol
  const pathname = request.nextUrl.pathname
  const search = request.nextUrl.search
  
  // Skip redirects for localhost and internal Next.js paths
  if (
    hostname.includes('localhost') ||
    hostname.includes('127.0.0.1') ||
    hostname.includes('0.0.0.0')
  ) {
    return await updateSession(request)
  }

  // Check if we need to redirect
  const needsHttpsRedirect = protocol === 'http:'
  const needsWwwRedirect = hostname.startsWith('www.')
  
  // If either redirect is needed, create the correct URL
  if (needsHttpsRedirect || needsWwwRedirect) {
    const targetHostname = needsWwwRedirect ? hostname.replace('www.', '') : hostname
    const targetUrl = `https://${targetHostname}${pathname}${search}`
    return NextResponse.redirect(targetUrl, 301)
  }

  // Continue with Supabase session update
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, videos, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|ogg|mp3|wav|pdf)$).*)',
  ],
}

