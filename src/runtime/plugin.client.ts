/**
 * Client-side Convex plugin with SSR token hydration.
 * Manually wires up setAuth() for zero-flash auth on first render.
 */
import { defineNuxtPlugin, useRuntimeConfig, useState } from '#app'
import { convexClient } from '@convex-dev/better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'
import { ConvexClient } from 'convex/browser'

interface TokenResponse {
  data?: { token: string } | null
  error?: unknown
}

type AuthClientWithConvex = ReturnType<typeof createAuthClient> & {
  convex: { token: () => Promise<TokenResponse> }
}

declare module '#app' {
  interface NuxtApp {
    _convexInitialized?: boolean
  }
}

const createLogger = (verbose: boolean) => {
  if (!verbose) return () => {}
  return (msg: string, data?: unknown) => console.log('[bcn:client] ' + msg, data ?? '')
}

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const log = createLogger(config.public.convex?.verbose ?? false)

  // HMR-safe initialization
  if (nuxtApp._convexInitialized) return
  nuxtApp._convexInitialized = true

  const convexUrl = config.public.convex?.url
  const siteUrl = config.public.convex?.siteUrl
    || config.public.convex?.auth?.url
    || convexUrl?.replace('.convex.cloud', '.convex.site')

  if (!convexUrl) {
    console.warn('[bcn] No Convex URL configured')
    return
  }

  // SSR-hydrated auth state
  const convexToken = useState<string | null>('convex:token')
  const convexUser = useState<unknown>('convex:user')

  log('Initializing', { hasToken: !!convexToken.value, hasUser: !!convexUser.value })

  // Create Convex WebSocket client
  const client = new ConvexClient(convexUrl)
  let authClient: AuthClientWithConvex | null = null

  if (siteUrl) {
    const authBaseURL = typeof window !== 'undefined'
      ? `${window.location.origin}/api/auth`
      : '/api/auth'

    authClient = createAuthClient({
      baseURL: authBaseURL,
      plugins: [convexClient()],
      fetchOptions: { credentials: 'include' },
    }) as AuthClientWithConvex

    // Token cache to avoid redundant fetches
    let lastTokenValidation = Date.now()
    const TOKEN_CACHE_MS = 10000

    const fetchToken = async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      log('fetchToken', { forceRefreshToken, hasToken: !!convexToken.value })

      // Use SSR-hydrated token if available
      if (convexToken.value && !forceRefreshToken) {
        lastTokenValidation = Date.now()
        return convexToken.value
      }

      // Use cached token if recently validated
      const timeSinceValidation = Date.now() - lastTokenValidation
      if (convexToken.value && forceRefreshToken && timeSinceValidation < TOKEN_CACHE_MS) {
        return convexToken.value
      }

      // Not authenticated if no SSR state
      if (!convexToken.value && !convexUser.value) {
        return null
      }

      // Fetch fresh token from Better Auth
      try {
        const response = await authClient!.convex.token()
        if (response.error || !response.data?.token) {
          convexToken.value = null
          return null
        }
        convexToken.value = response.data.token
        lastTokenValidation = Date.now()
        return response.data.token
      } catch {
        convexToken.value = null
        return null
      }
    }

    client.setAuth(fetchToken, (isAuthenticated) => {
      log('Auth state changed', { isAuthenticated })
    })
  }

  // Provide clients globally
  nuxtApp.provide('convex', client)
  if (authClient) {
    nuxtApp.provide('auth', authClient)
  }

  // Expose for debugging
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__convex_client__ = client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (authClient) (window as any).__auth_client__ = authClient
  }

  log('Initialized')
})
