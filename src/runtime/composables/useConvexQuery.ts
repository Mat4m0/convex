import type { ConvexClient } from 'convex/browser'
import type { FunctionReference, FunctionArgs, FunctionReturnType } from 'convex/server'
import type { AsyncData } from '#app'

import { useNuxtApp, useRuntimeConfig, useRequestEvent, useAsyncData } from '#imports'
import { computed, watch, triggerRef, onUnmounted, toValue, isRef, type Ref } from 'vue'

import {
  getFunctionName,
  stableStringify,
  getQueryKey,
  parseConvexResponse,
  computeQueryStatus,
  createQueryLogger,
  fetchAuthToken,
  registerSubscription,
  hasSubscription,
  removeFromSubscriptionCache,
  cleanupSubscription,
  type QueryStatus,
} from '../utils/convex-cache'

// Re-export for consumers
export type { QueryStatus }
export { parseConvexResponse, computeQueryStatus, getQueryKey }

/**
 * Options for useConvexQuery
 */
export interface UseConvexQueryOptions<RawT, DataT = RawT> {
  /** Don't block when awaited. Query runs in background. @default false */
  lazy?: boolean
  /** Run query on server during SSR. @default true */
  server?: boolean
  /** Subscribe to real-time updates via WebSocket. @default true */
  subscribe?: boolean
  /** Factory function for default data value. */
  default?: () => DataT | undefined
  /** Transform data after fetching. */
  transform?: (input: RawT) => DataT
  /** Enable verbose logging for debugging. @default false */
  verbose?: boolean
  /** Mark this query as public (no authentication needed). @default false */
  public?: boolean
}

type MaybeRef<T> = T | Ref<T>

/**
 * Execute query via HTTP (works on both server and client without WebSocket)
 * @internal
 */
export async function executeQueryHttp<T>(
  convexUrl: string,
  functionPath: string,
  args: Record<string, unknown>,
  authToken?: string,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const response = await $fetch(`${convexUrl}/api/query`, {
    method: 'POST',
    headers,
    body: { path: functionPath, args: args ?? {} },
  })

  return parseConvexResponse<T>(response)
}

/**
 * Execute a one-shot query using the WebSocket subscription.
 * Resolves when the first update arrives.
 * @internal
 */
export function executeQueryViaSubscription<Query extends FunctionReference<'query'>>(
  convex: ConvexClient,
  query: Query,
  args: FunctionArgs<Query>,
): Promise<FunctionReturnType<Query>> {
  return new Promise((resolve) => {
    let resolved = false
    const unsubscribe = convex.onUpdate(query, args, (result: FunctionReturnType<Query>) => {
      if (!resolved) {
        resolved = true
        unsubscribe()
        resolve(result)
      }
    })
  })
}

/**
 * A Nuxt composable for querying Convex with SSR support and real-time subscriptions.
 *
 * Returns a standard Nuxt `AsyncData` object that is thenable (can be awaited).
 *
 * @example
 * ```vue
 * <script setup>
 * // Basic usage - await blocks navigation until data loads
 * const { data } = await useConvexQuery(api.posts.list)
 *
 * // With args
 * const { data } = await useConvexQuery(api.posts.get, { slug: 'hello' })
 *
 * // Skip query conditionally
 * const { data } = await useConvexQuery(api.users.get, userId ? { id: userId } : 'skip')
 *
 * // Lazy - doesn't block navigation
 * const { data, pending } = await useConvexQuery(api.posts.list, {}, { lazy: true })
 *
 * // Transform data after fetching
 * const { data } = await useConvexQuery(api.posts.list, {}, {
 *   transform: (posts) => posts?.map(p => ({ ...p, formattedDate: formatDate(p.publishedAt) }))
 * })
 * </script>
 * ```
 */
export function useConvexQuery<
  Query extends FunctionReference<'query'>,
  Args extends FunctionArgs<Query> | 'skip' = FunctionArgs<Query>,
  DataT = FunctionReturnType<Query>,
>(
  query: Query,
  args?: MaybeRef<Args> | Args,
  options?: UseConvexQueryOptions<FunctionReturnType<Query>, DataT>,
): AsyncData<DataT | undefined, Error | null> {
  type RawT = FunctionReturnType<Query>

  const nuxtApp = useNuxtApp()
  const config = useRuntimeConfig()

  // Resolve options
  const lazy = options?.lazy ?? false
  const server = options?.server ?? true
  const subscribe = options?.subscribe ?? true
  const verbose = options?.verbose ?? (config.public.convex?.verbose ?? false)
  const isPublic = options?.public ?? false

  // Get function name for cache key and logging
  const fnName = getFunctionName(query)
  const log = createQueryLogger(verbose, 'useConvexQuery', query)

  log('Initializing', { lazy, server, public: isPublic })

  // Get reactive args value
  const getArgs = (): Args => toValue(args) ?? ({} as Args)
  const isSkipped = computed(() => getArgs() === 'skip')

  // Generate cache key
  const getCacheKey = (): string => {
    const currentArgs = getArgs()
    if (currentArgs === 'skip') return `convex:skip:${fnName}`
    return getQueryKey(query, currentArgs)
  }

  const cacheKey = getCacheKey()
  log('Cache key', { key: cacheKey })

  // Transform helper
  const applyTransform = (raw: RawT): DataT => {
    return options?.transform ? options.transform(raw) : (raw as unknown as DataT)
  }

  // Get request event and cookies for SSR auth
  const event = import.meta.server ? useRequestEvent() : null
  const cookieHeader = event?.headers.get('cookie') || ''

  // Use Nuxt's useAsyncData for SSR + hydration
  const asyncData = useAsyncData<DataT | undefined, Error>(
    cacheKey,
    async () => {
      if (isSkipped.value) {
        log('Skipped')
        return undefined
      }

      const convexUrl = config.public.convex?.url
      if (!convexUrl) {
        throw new Error('[useConvexQuery] Convex URL not configured')
      }

      const currentArgs = getArgs() as FunctionArgs<Query>

      // SSR: fetch via HTTP
      if (import.meta.server) {
        const siteUrl = config.public.convex?.siteUrl || config.public.convex?.auth?.url
        log('Fetching via HTTP (SSR)', { args: currentArgs })

        const authToken = await fetchAuthToken({
          isPublic,
          cookieHeader,
          siteUrl,
          log,
        })

        const result = await executeQueryHttp<RawT>(convexUrl, fnName, currentArgs, authToken)
        log('SSR fetch succeeded', { hasData: result !== undefined })
        return applyTransform(result)
      }

      // Client: use WebSocket for first result
      const convex = nuxtApp.$convex as ConvexClient | undefined
      if (!convex) {
        throw new Error('[useConvexQuery] Convex client not available')
      }

      log('Fetching via WebSocket (Client)', { args: currentArgs })
      const result = await executeQueryViaSubscription(convex, query, currentArgs)
      log('Client fetch succeeded', { hasData: result !== undefined })
      return applyTransform(result)
    },
    {
      server,
      lazy,
      default: options?.default,
      // Watch reactive args to trigger re-fetch
      watch: isRef(args) ? [args as Ref<unknown>] : undefined,
    },
  )

  // Track subscription for cleanup
  let unsubscribeFn: (() => void) | null = null

  // Setup WebSocket subscription bridge on client
  if (import.meta.client && subscribe) {
    const setupSubscription = () => {
      const currentArgs = getArgs()
      if (currentArgs === 'skip') {
        log('Skipping subscription (args=skip)')
        return
      }

      const convex = nuxtApp.$convex as ConvexClient | undefined
      if (!convex) {
        log('No Convex client available')
        return
      }

      const currentCacheKey = getCacheKey()

      // Check subscription cache to prevent duplicates
      if (hasSubscription(nuxtApp, currentCacheKey)) {
        log('Subscription already exists, reusing')
        return
      }

      log('Starting subscription', { args: currentArgs })

      try {
        unsubscribeFn = convex.onUpdate(query, currentArgs as FunctionArgs<Query>, (result: RawT) => {
          log('Subscription update', { hasData: result !== undefined })
          // Cast needed because useAsyncData has complex PickFrom type
          ;(asyncData.data as Ref<DataT | undefined>).value = applyTransform(result)
          // Force Vue reactivity for all watchers
          triggerRef(asyncData.data)
        })
        registerSubscription(nuxtApp, currentCacheKey, unsubscribeFn)
        log('Subscription started')
      } catch (e) {
        log('Subscription failed', { error: e })
      }
    }

    // Setup initial subscription
    setupSubscription()

    // Watch for reactive args changes to update subscription
    if (isRef(args)) {
      watch(
        () => toValue(args),
        (newArgs, oldArgs) => {
          if (stableStringify(newArgs) !== stableStringify(oldArgs)) {
            log('Args changed, updating subscription', { from: oldArgs, to: newArgs })

            // Cleanup old subscription
            const oldCacheKey = getQueryKey(query, oldArgs)
            cleanupSubscription(nuxtApp, oldCacheKey)
            unsubscribeFn = null

            // Setup new subscription (data will be updated by useAsyncData's watch)
            if (newArgs !== 'skip') {
              setupSubscription()
            }
          }
        },
        { deep: true },
      )
    }

    // Cleanup on unmount
    onUnmounted(() => {
      if (unsubscribeFn) {
        log('Unmounting, cleaning up subscription')
        removeFromSubscriptionCache(nuxtApp, getCacheKey())
        unsubscribeFn()
        unsubscribeFn = null
      }
    })
  }

  return asyncData as AsyncData<DataT | undefined, Error | null>
}
