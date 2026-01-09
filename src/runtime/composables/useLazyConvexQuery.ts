import type { FunctionReference, FunctionArgs, FunctionReturnType } from 'convex/server'
import type { Ref } from 'vue'
import type { AsyncData } from '#app'

import type { UseConvexQueryOptions } from './useConvexQuery'
import { useConvexQuery } from './useConvexQuery'

type MaybeRef<T> = T | Ref<T>

/**
 * Convenience alias for `useConvexQuery` with `lazy: true`.
 *
 * Does not block client-side navigation. Query runs in background and shows loading state.
 *
 * @deprecated Use `useConvexQuery(query, args, { lazy: true })` instead.
 *
 * @example
 * ```vue
 * <script setup>
 * import { api } from '~/convex/_generated/api'
 *
 * // Same as useConvexQuery(api.posts.list, {}, { lazy: true })
 * const { data, pending } = useLazyConvexQuery(api.posts.list)
 * </script>
 *
 * <template>
 *   <div v-if="pending">Loading...</div>
 *   <PostList v-else :posts="data" />
 * </template>
 * ```
 */
export function useLazyConvexQuery<
  Query extends FunctionReference<'query'>,
  Args extends FunctionArgs<Query> | 'skip' = FunctionArgs<Query>,
>(
  query: Query,
  args?: MaybeRef<Args> | Args,
  options?: Omit<UseConvexQueryOptions<FunctionReturnType<Query>>, 'lazy'>,
): AsyncData<FunctionReturnType<Query> | undefined, Error | null> {
  return useConvexQuery(query, args, {
    ...options,
    lazy: true,
  })
}
