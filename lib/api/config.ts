/**
 * API Base URL Configuration
 * 
 * All APIs use the main domain (relative paths)
 * This ensures all requests go through the same domain
 */

/**
 * Get API URL - always returns relative path (main domain)
 * @param path - API path starting with /api/...
 * @returns Relative path for main domain access
 */
export const getApiUrlWithSubdomain = (path: string): string => {
  // Always use relative path (main domain)
  // This ensures all API calls go through the main domain
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return normalizedPath;
};

/**
 * Get fetch options for API calls
 * Uses Authorization header with Bearer token instead of cookies
 * @param options - Additional fetch options
 * @param token - Optional Bearer token for authentication
 * @returns Fetch options with CORS settings and Authorization header
 */
export const getSubdomainFetchOptions = (options: RequestInit = {}, token?: string): RequestInit => {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Add Content-Type only for requests with body (POST, PUT, PATCH)
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH'].includes(method) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Add Authorization header if token is provided
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return {
    ...options,
    mode: 'cors', // Enable CORS
    headers,
  };
};

