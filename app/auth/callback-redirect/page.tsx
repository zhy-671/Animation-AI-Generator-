'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CallbackRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    // Get redirect URL from sessionStorage or default to home
    const redirectUrl = typeof window !== 'undefined' 
      ? sessionStorage.getItem('loginRedirectUrl') || '/'
      : '/'
    
    // Clean up sessionStorage
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('loginRedirectUrl')
    }

    // Force a full page reload to ensure Header updates
    window.location.href = redirectUrl
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-white">Redirecting...</div>
    </div>
  )
}

