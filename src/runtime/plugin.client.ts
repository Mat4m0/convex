/**
 * Client-side Convex plugin with SSR token hydration
 *
 * Design decision: We manually wire up setAuth() instead of using the ConvexAuthProvider
 * from @convex-dev/better-auth because:
 * 1. We need to inject the SSR-fetched token on first render (zero flash)
 * 2. We need control over the token fetching to support useState hydration
 *
 * The fetchToken function is called by ConvexClient:
 * - Immediately on setAuth()
 * - When forceRefreshToken is true (server rejected token or near expiry)
 * - On WebSocket reconnection
 */

import { defineNuxtPlugin, useRuntimeConfig, useState } from '#app'
import { convexClient } from '@convex-dev/better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'
import { ConvexClient } from 'convex/browser'

import { createLogger, getVerboseFlag } from './utils/logger'

// Type for authClient with convex plugin
type AuthClientWithConvex = ReturnType<typeof createAuthClient> & {
  convex: {
    token: () => Promise<{ data: { token: string } | null; error: unknown }>
  }
}

// Extend NuxtApp for HMR-safe initialization tracking
declare module '#app' {
  interface NuxtApp {
    _convexInitialized?: boolean
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const log = createLogger({
    verbose: getVerboseFlag(config),
    prefix: '[bcn:client]',
  })
  log('Plugin starting')

  // HMR-safe: Skip if already initialized (module-level vars persist across HMR)
  if (nuxtApp._convexInitialized) {
    log('Already initialized (HMR), skipping')
    return
  }
  nuxtApp._convexInitialized = true

  const convexUrl = config.public.convex?.url
  // siteUrl is the HTTP endpoint URL (for auth), defaults to url with .cloud -> .site
  const siteUrl =
    config.public.convex?.siteUrl ||
    config.public.convex?.auth?.url ||
    (convexUrl?.replace('.convex.cloud', '.convex.site') ?? '')

  log('Config loaded', { convexUrl, siteUrl })

  if (!convexUrl) {
    log('No Convex URL configured, aborting')
    console.warn('[bcn] No Convex URL configured')
    return
  }

  // Read SSR-fetched token from useState (populated by server plugin)
  const convexToken = useState<string | null>('convex:token')
  const convexUser = useState<unknown>('convex:user')

  log('SSR hydration state', {
    hasToken: !!convexToken.value,
    hasUser: !!convexUser.value,
  })

  // Create ConvexClient (WebSocket-based for real-time queries)
  const client = new ConvexClient(convexUrl)
  log('ConvexClient created')

  // Initialize Better Auth if site URL is configured
  let authClient: AuthClientWithConvex | null = null

  if (siteUrl) {
    // Construct absolute URL for Better Auth (requires absolute URL, not relative)
    // Use current origin to proxy through Nuxt server routes (avoids CORS)
    const authBaseURL =
      typeof window !== 'undefined' ? `${window.location.origin}/api/auth` : '/api/auth'

    log('Creating Better Auth client', { authBaseURL })

    authClient = createAuthClient({
      baseURL: authBaseURL,
      plugins: [
        convexClient(), // Adds authClient.convex.token() for JWT retrieval
      ],
      fetchOptions: {
        credentials: 'include', // Required for cross-domain cookies
      },
    }) as AuthClientWithConvex

    // Token fetcher for Convex authentication
    // Uses SSR token first, then fetches via authClient.convex.token()
    //
    // OPTIMIZATION: Track when we last validated/fetched a token to avoid redundant requests.
    // The Convex client calls fetchToken multiple times:
    // 1. First with forceRefreshToken: false (uses SSR token)
    // 2. Then with forceRefreshToken: true after server confirms (to schedule refresh)
    // We cache the token briefly to avoid the second call triggering a network request.
    let lastTokenValidation = Date.now()
    const TOKEN_CACHE_MS = 10000 // Don't re-fetch within 10 seconds

    const fetchToken = async ({
      forceRefreshToken,
    }: {
      forceRefreshToken: boolean
    }): Promise<string | null> => {
      log('fetchToken called', { forceRefreshToken, hasSSRToken: !!convexToken.value })

      // Use SSR-hydrated token if available and not forcing refresh
      if (convexToken.value && !forceRefreshToken) {
        log('Using SSR-hydrated token')
        lastTokenValidation = Date.now()
        return convexToken.value
      }

      // If we have a token and it was recently validated/fetched, reuse it
      // This prevents redundant fetches when Convex client proactively refreshes
      const now = Date.now()
      const timeSinceValidation = now - lastTokenValidation
      if (convexToken.value && forceRefreshToken && timeSinceValidation < TOKEN_CACHE_MS) {
        log('Using cached token (validated recently)', { timeSinceValidation })
        return convexToken.value
      }

      // Fetch fresh token from Better Auth via authClient.convex.token()
      // This handles both SSR mode (refresh) and CSR-only mode (initial fetch)
      log('Fetching fresh token from auth server')
      try {
        const response = await authClient!.convex.token()

        if (response.error || !response.data?.token) {
          log('Token fetch failed', { error: response.error })
          convexToken.value = null
          convexUser.value = null
          return null
        }

        const token = response.data.token
        log('Token fetch succeeded')
        convexToken.value = token
        lastTokenValidation = Date.now()

        // Extract user from JWT payload (for CSR-only mode where SSR didn't hydrate user)
        if (!convexUser.value) {
          try {
            const payloadBase64 = token.split('.')[1]
            if (payloadBase64) {
              const payload = JSON.parse(atob(payloadBase64))
              if (payload.sub || payload.userId || payload.email) {
                convexUser.value = {
                  id: payload.sub || payload.userId || '',
                  name: payload.name || '',
                  email: payload.email || '',
                  emailVerified: payload.emailVerified,
                  image: payload.image,
                }
                log('User extracted from JWT', {
                  userId: (convexUser.value as { id: string }).id,
                })
              }
            }
          } catch {
            // Non-fatal: token is still valid, just couldn't extract user
          }
        }

        return token
      } catch (error) {
        log('Token fetch error', { error: error instanceof Error ? error.message : error })
        convexToken.value = null
        convexUser.value = null
        return null
      }
    }

    client.setAuth(fetchToken, (isAuthenticated) => {
      log('Auth state changed', { isAuthenticated })
    })

    log('Auth configured and setAuth called')
  } else {
    log('No siteUrl, skipping auth setup')
  }

  // Provide clients globally via NuxtApp
  nuxtApp.provide('convex', client)
  if (authClient) {
    nuxtApp.provide('auth', authClient)
  }

  log('Clients provided to NuxtApp')

  // Expose for testing and debugging
  if (typeof window !== 'undefined') {
    const w = window as Window & {
      __convex_client__?: typeof client
      __auth_client__?: typeof authClient
    }
    w.__convex_client__ = client
    if (authClient) {
      w.__auth_client__ = authClient
    }
  }

  log('Plugin initialization complete')
})
