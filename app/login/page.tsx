'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Suspense } from 'react'
import Header from '@/components/header/header'

// Google Icon Component
function GoogleIcon() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

function LoginPageContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Save current page URL when component mounts (if not already saved)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const from = searchParams.get('from')
      // Only save if not already set via query param
      if (!from && !sessionStorage.getItem('loginRedirectUrl')) {
        // Try to get from document.referrer or default to home
        const referrer = document.referrer
        const currentUrl = window.location.href
        // Don't save if referrer is login page or auth callback
        if (referrer && !referrer.includes('/login') && !referrer.includes('/auth/callback')) {
          try {
            const referrerUrl = new URL(referrer)
            // Only save if same origin
            if (referrerUrl.origin === window.location.origin) {
              sessionStorage.setItem('loginRedirectUrl', referrerUrl.pathname + referrerUrl.search)
            }
          } catch (e) {
            // Invalid URL, ignore
          }
        }
      }
    }
  }, [searchParams])

  // Get the redirect URL from query params or sessionStorage
  const getRedirectUrl = () => {
    const from = searchParams.get('from')
    let redirectUrl = '/'
    
    if (from) {
      redirectUrl = decodeURIComponent(from)
    } else if (typeof window !== 'undefined') {
      // Try to get from sessionStorage
      const savedUrl = sessionStorage.getItem('loginRedirectUrl')
      if (savedUrl) {
        sessionStorage.removeItem('loginRedirectUrl')
        redirectUrl = savedUrl
      }
    }
    
    // Normalize redirect URL - don't redirect to non-existent pages
    if (redirectUrl === '/sign-in' || redirectUrl.startsWith('/sign-in')) {
      redirectUrl = '/'
    }
    
    // Don't redirect back to login or auth pages
    if (redirectUrl === '/login' || redirectUrl.startsWith('/auth/')) {
      redirectUrl = '/'
    }
    
    return redirectUrl
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    } else {
      // Get redirect URL and navigate back
      const redirectUrl = getRedirectUrl()
      // Force a full page reload to ensure Header updates
      window.location.href = redirectUrl
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    } else {
      setError('Check your email for the confirmation link!')
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Save redirect URL for OAuth callback
      const redirectUrl = getRedirectUrl()
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('loginRedirectUrl', redirectUrl)
      }
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectUrl)}`,
        },
      })
      if (error) {
        setError(error.message || 'Failed to initiate Google sign in. Please check your Google OAuth configuration.')
        setIsLoading(false)
        return
      }

      // Check if we got a URL to redirect to
      if (data?.url) {
        // Validate that the URL is actually a Google OAuth URL
        if (data.url.includes('accounts.google.com') || data.url.includes('supabase.co')) {
          // Manually redirect to the OAuth URL
          window.location.href = data.url
          return
        } else {
          // URL doesn't look like a valid OAuth URL
          setError('Invalid OAuth URL received. Please check your Google OAuth configuration in Supabase Dashboard.')
          setIsLoading(false)
          return
        }
      }

      // If no URL was returned, show an error
      setError('Failed to initiate Google sign in. Please check your Google OAuth configuration in Supabase Dashboard.')
      setIsLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setIsLoading(false)
    }
  }

  return (
    <>
      <Header />
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Welcome Back</h1>
          <p className="mt-2 text-gray-400">Sign in to your account</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSignIn}>
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFDA2A] focus:border-transparent"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFDA2A] focus:border-transparent"
                placeholder="Enter your password"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#FFDA2A] text-gray-900 hover:bg-[#FFDA2A]/90 h-12 text-base font-medium"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>

            <Button
              type="button"
              onClick={handleSignUp}
              disabled={isLoading}
              variant="outline"
              className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 h-12 text-base font-medium"
            >
              {isLoading ? 'Signing up...' : 'Sign Up'}
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-900 text-gray-400">Or continue with</span>
            </div>
          </div>

          {/* Google Sign In Button */}
          <Button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            variant="outline"
            className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white h-12 text-base font-medium flex items-center justify-center gap-3"
          >
            <GoogleIcon />
            <span>Sign in with Google</span>
          </Button>

          <div className="text-center">
            <Link
              href="/"
              className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              ← Back to home
            </Link>
          </div>
        </form>
        </div>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}

