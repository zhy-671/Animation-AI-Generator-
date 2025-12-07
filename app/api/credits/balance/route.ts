import { NextRequest, NextResponse } from 'next/server'
import { getCurrentCustomer } from '@/lib/supabase/customers'
import { createClient } from '@/lib/supabase/server'

/**
 * Helper function to add CORS headers
 */
function addCorsHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get('origin')
  
  // Allow requests from main domain and localhost
  const allowedOrigins = [
    'https://videoaimusic.com',
    'https://www.videoaimusic.com',
    'http://localhost:3000',
    'http://localhost:3001',
  ]
  
  // Check if origin is allowed
  const isAllowedOrigin = origin && (
    allowedOrigins.includes(origin) ||
    origin.includes('localhost')
  )
  
  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    // Note: Not setting Access-Control-Allow-Credentials since we use Bearer Token, not cookies
  }
  
  // Get requested method and headers from preflight request
  const requestedMethod = request.headers.get('Access-Control-Request-Method')
  const requestedHeaders = request.headers.get('Access-Control-Request-Headers')
  
  // Set allowed methods
  if (requestedMethod) {
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  } else {
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  }
  
  // Set allowed headers - include requested headers if present
  const allowedHeaders = [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Referer',
    'User-Agent',
    'sec-fetch-mode',
    'sec-fetch-site',
    'sec-fetch-dest',
    'sec-ch-ua',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform',
  ]
  
  if (requestedHeaders) {
    // Merge requested headers with allowed headers
    const requestedHeadersList = requestedHeaders.split(',').map(h => h.trim().toLowerCase())
    const mergedHeaders = [...new Set([...allowedHeaders.map(h => h.toLowerCase()), ...requestedHeadersList])]
    response.headers.set('Access-Control-Allow-Headers', mergedHeaders.join(', '))
  } else {
    response.headers.set('Access-Control-Allow-Headers', allowedHeaders.join(', '))
  }
  
  response.headers.set('Access-Control-Max-Age', '86400') // 24 hours
  
  return response
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 })
  return addCorsHeaders(response, request)
}

/**
 * GET /api/credits/balance
 * 获取当前用户的积分余额
 * 使用 Authorization header 中的 Bearer token 进行认证
 */
export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response = NextResponse.json(
        { error: 'User not authenticated', details: 'Missing or invalid Authorization header' },
        { status: 401 }
      )
      return addCorsHeaders(response, request)
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify token and get user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      // Log detailed error for debugging
      console.error('[Credits Balance API] Token validation failed:', {
        hasToken: !!token,
        tokenLength: token?.length,
        error: authError?.message,
        errorName: authError?.name,
        hasUser: !!user,
      })
      
      const response = NextResponse.json(
        { 
          error: 'User not authenticated', 
          details: authError?.message || 'Invalid token',
          hint: authError?.message?.includes('expired') ? 'Token may be expired. Please refresh your session.' : undefined
        },
        { status: 401 }
      )
      return addCorsHeaders(response, request)
    }

    // Get customer record using the verified user
    const { data: customer, error: customerError } = await supabase
      .from('anim_customers')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (customerError || !customer) {
      const response = NextResponse.json(
        { error: 'Customer not found', details: customerError?.message },
        { status: 404 }
      )
      return addCorsHeaders(response, request)
    }
    const response = NextResponse.json({
      credits: customer.credits,
      customerId: customer.id,
    })
    return addCorsHeaders(response, request)
  } catch (error) {
    const response = NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
    return addCorsHeaders(response, request)
  }
}

