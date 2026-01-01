import type { createAuthClient } from 'better-auth/vue'
import type { ConvexClient } from 'convex/browser'

type AuthClient = ReturnType<typeof createAuthClient>

declare module '#app' {
  interface NuxtApp {
    $convex: ConvexClient
    $auth?: AuthClient
    /** Internal cache for WebSocket subscriptions (prevents duplicates) */
    _convexSubscriptions?: Record<string, () => void>
  }

  interface RuntimeConfig {
    public: {
      convex: {
        /** Convex deployment URL (WebSocket) */
        url: string
        /** Convex site URL (HTTP/Auth) */
        siteUrl: string
        /** Enable verbose logging for debugging */
        verbose: boolean
        /** @deprecated Use siteUrl instead */
        auth?: {
          url: string
        }
      }
    }
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $convex: ConvexClient
    $auth?: AuthClient
  }
}

export {}
