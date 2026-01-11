<script setup lang="ts">
/**
 * Renders slot content when authentication has failed or encountered an error.
 * Use this to display error messages or retry UI when auth operations fail.
 *
 * Checks for auth error state: user has session cookie but no valid token.
 * This indicates a failed auth exchange (expired session, invalid token, etc.)
 *
 * @example
 * ```vue
 * <ConvexAuthError>
 *   <div class="error">
 *     <p>Authentication failed. Please try again.</p>
 *     <button @click="handleRetry">Retry</button>
 *   </div>
 * </ConvexAuthError>
 * ```
 *
 * @example With custom error handling
 * ```vue
 * <ConvexAuthError v-slot="{ retry }">
 *   <ErrorCard
 *     message="Session expired"
 *     :onRetry="retry"
 *   />
 * </ConvexAuthError>
 * ```
 */
import { computed } from 'vue'
import { useConvexAuth } from '../composables/useConvexAuth'

const { isAuthenticated, isPending, token, user } = useConvexAuth()

/**
 * Detect auth error state:
 * - Not pending (auth check complete)
 * - Not authenticated
 * - But we expected authentication (this component is rendered)
 */
const hasError = computed(() => {
  // Auth is still loading
  if (isPending.value) return false

  // Successfully authenticated
  if (isAuthenticated.value) return false

  // Has token but no user = potential decode error
  if (token.value && !user.value) return true

  // No token and no user after loading = auth failed or not logged in
  // We show error only if there was an attempt (not initial unauthenticated state)
  return false
})

/**
 * Retry authentication by reloading the page
 */
function retry() {
  window.location.reload()
}
</script>

<template>
  <slot v-if="hasError" :retry="retry" />
</template>
