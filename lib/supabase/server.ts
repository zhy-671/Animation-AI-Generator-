import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Custom fetch with timeout, retry logic, and better error handling
 * Optimized for Supabase connection stability
 */
function createFetchWithTimeout(timeoutMs: number = 60000) { // Increased to 60 seconds
  return async (url: RequestInfo | URL, options: RequestInit = {}, retries: number = 2): Promise<Response> => {
    const maxRetries = retries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      try {
        // Combine abort signals if both are provided
        let finalSignal = controller.signal;
        if (options.signal) {
          const combinedController = new AbortController();
          const abort = () => combinedController.abort();
          options.signal.addEventListener('abort', abort);
          controller.signal.addEventListener('abort', abort);
          finalSignal = combinedController.signal;
        }

        // Use the caller's headers as-is to stay HTTP/2 compliant
        const response = await fetch(url, {
          ...options,
          signal: finalSignal,
        });

        clearTimeout(timeoutId);
        
        // Retry on 5xx errors (server errors)
        if (response.status >= 500 && attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
          continue;
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if it's a network error that should be retried
        const isNetworkError = 
          lastError.name === 'AbortError' ||
          lastError.message.includes('fetch failed') ||
          lastError.message.includes('timeout') ||
          lastError.message.includes('ECONNREFUSED') ||
          lastError.message.includes('ENOTFOUND') ||
          lastError.message.includes('ETIMEDOUT') ||
          lastError.message.includes('UND_ERR_CONNECT_TIMEOUT');

        if (isNetworkError && attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt); // Exponential backoff: 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // If it's the last attempt or not a network error, throw
        if (attempt === maxRetries || !isNetworkError) {
          if (lastError.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeoutMs}ms: ${url}`);
          }
          if (lastError.message.includes('fetch failed')) {
            throw new Error(`Network error connecting to Supabase: ${lastError.message}`);
          }
          throw lastError;
        }
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError || new Error('Unknown error in fetch retry logic');
  };
}

export async function createClient() {
  // Increased timeout to 60 seconds and added retry logic for better stability
  const customFetch = createFetchWithTimeout(60000);

  try {
    const cookieStore = await cookies()

    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
        global: {
          fetch: customFetch,
        },
      }
    )
  } catch (error) {
    // If cookies() fails (e.g., in static generation or edge runtime),
    // create a client without cookie persistence
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return []
          },
          setAll() {
            // No-op when cookies aren't available
          },
        },
        global: {
          fetch: customFetch,
        },
      }
    )
  }
}

