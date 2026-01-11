import type { H3Event } from 'h3'
import {
  defineEventHandler,
  proxyRequest,
  setHeaders,
  setResponseStatus,
  createError,
  getRequestURL,
} from 'h3'
import { useRuntimeConfig } from '#imports'

/**
 * Validates if the given origin is allowed based on siteUrl and trustedOrigins.
 * Supports wildcard patterns (e.g., 'https://preview-*.vercel.app').
 */
function isOriginAllowed(
  origin: string,
  siteUrl: string | undefined,
  trustedOrigins: string[],
): boolean {
  // Check against siteUrl (extract origin from full URL)
  if (siteUrl) {
    try {
      const siteOrigin = new URL(siteUrl).origin
      if (origin === siteOrigin) return true
    } catch {
      // Invalid siteUrl, skip this check
    }
  }

  // Check against trustedOrigins (exact match or wildcard pattern)
  for (const trusted of trustedOrigins) {
    if (trusted.includes('*')) {
      // Convert wildcard pattern to regex
      const pattern = trusted
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except *
        .replace(/\*/g, '.*') // Convert * to .*
      if (new RegExp(`^${pattern}$`).test(origin)) return true
    } else if (origin === trusted) {
      return true
    }
  }

  return false
}

export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig()
  const siteUrl = config.public.convex?.siteUrl as string | undefined
  const trustedOrigins = (config.public.convex?.trustedOrigins as string[]) ?? []

  if (!siteUrl) {
    throw createError({
      statusCode: 500,
      message: 'Convex site URL not configured',
    })
  }

  // Get the full URL with path and query
  const requestUrl = getRequestURL(event)
  const path = requestUrl.pathname.replace(/^\/api\/auth/, '') || '/'
  const target = `${siteUrl}/api/auth${path}${requestUrl.search}`

  // Handle CORS preflight
  // Security: Only allow CORS for validated origins
  if (event.method === 'OPTIONS') {
    const origin = event.headers.get('origin')
    if (!origin || !isOriginAllowed(origin, siteUrl, trustedOrigins)) {
      setResponseStatus(event, 403)
      return null
    }
    setHeaders(event, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    })
    setResponseStatus(event, 204)
    return null
  }

  // Set CORS headers for the response (only for validated origins)
  const origin = event.headers.get('origin')
  if (origin && isOriginAllowed(origin, siteUrl, trustedOrigins)) {
    setHeaders(event, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Expose-Headers': 'Set-Cookie',
    })
  }

  try {
    // Use H3's proxyRequest for the actual proxying
    // proxyRequest handles: method, headers, body, and response forwarding
    return await proxyRequest(event, target, {
      // Don't send host header (would cause issues with the target server)
      headers: {
        host: undefined,
      },
      fetchOptions: {
        credentials: 'include',
      },
    })
  } catch (error) {
    // Security: Don't leak internal error details in production
    const errorMessage = import.meta.dev
      ? `Failed to proxy request to Convex: ${error instanceof Error ? error.message : String(error)}`
      : 'Failed to proxy request to Convex'
    throw createError({
      statusCode: 502,
      message: errorMessage,
    })
  }
})
