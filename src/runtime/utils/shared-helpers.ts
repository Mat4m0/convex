/**
 * Shared helper functions used across composables
 *
 * These utilities are extracted to avoid code duplication and ensure
 * consistent behavior across the module.
 */

import type { Value } from 'convex/values'
import { convexToJson } from 'convex/values'

// ============================================================================
// Deep Equality & Comparison
// ============================================================================

/**
 * Check if two values are deeply equal using structured comparison.
 * More performant than JSON.stringify for simple cases, handles edge cases better.
 *
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns True if values are deeply equal
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  // Same reference or primitive equality
  if (a === b) return true

  // Handle null/undefined
  if (a == null || b == null) return a === b

  // Handle different types
  if (typeof a !== typeof b) return false

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }

  // Handle objects (but not arrays which were handled above)
  if (typeof a === 'object' && typeof b === 'object') {
    // Don't compare array to object
    if (Array.isArray(a) !== Array.isArray(b)) return false

    const aKeys = Object.keys(a as object)
    const bKeys = Object.keys(b as object)

    if (aKeys.length !== bKeys.length) return false

    for (const key of aKeys) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false
      if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
        return false
      }
    }
    return true
  }

  // Primitive comparison (already handled by === above)
  return false
}

/**
 * Check if query args match filter args (partial match).
 * Used for optimistic update helpers to filter which queries to update.
 *
 * @param queryArgs - The full args of a query
 * @param filterArgs - Partial args to match against
 * @param skipKeys - Keys to skip during comparison (e.g., 'paginationOpts')
 * @returns True if all filterArgs match corresponding queryArgs
 */
export function argsMatch(
  queryArgs: Record<string, unknown>,
  filterArgs: Record<string, unknown>,
  skipKeys: string[] = [],
): boolean {
  for (const key of Object.keys(filterArgs)) {
    // Skip specified keys
    if (skipKeys.includes(key)) continue

    const filterValue = filterArgs[key]
    const queryValue = queryArgs[key]

    // Use deep equality for comparison
    if (!deepEqual(filterValue, queryValue)) {
      return false
    }
  }
  return true
}

/**
 * Compare two Convex JSON values for sorting.
 * Returns negative if a < b, 0 if equal, positive if a > b.
 *
 * Handles all Convex value types including arrays (for multi-key sorts),
 * numbers, strings, booleans, BigInts, and null/undefined.
 *
 * @param a - First value (convexToJson format)
 * @param b - Second value (convexToJson format)
 * @returns Comparison result (-1, 0, or 1)
 */
export function compareJsonValues(a: unknown, b: unknown): number {
  // Handle arrays (multi-key sort)
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const comparison = compareJsonValues(a[i], b[i])
      if (comparison !== 0) return comparison
    }
    return 0
  }

  // Handle null/undefined
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1

  // Handle numbers
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }

  // Handle strings
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b)
  }

  // Handle booleans
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return (a ? 1 : 0) - (b ? 1 : 0)
  }

  // Handle BigInt ($integer format from convexToJson)
  if (
    typeof a === 'object' &&
    a !== null &&
    '$integer' in a &&
    typeof b === 'object' &&
    b !== null &&
    '$integer' in b
  ) {
    const aInt = a as { $integer: string }
    const bInt = b as { $integer: string }
    return Number(BigInt(aInt.$integer) - BigInt(bInt.$integer))
  }

  // Fallback to string comparison
  return String(a).localeCompare(String(b))
}

/**
 * Compare two Convex values using their JSON representation.
 * Convenience wrapper around compareJsonValues that handles serialization.
 *
 * @param a - First Convex value
 * @param b - Second Convex value
 * @returns Comparison result (-1, 0, or 1)
 */
export function compareConvexValues(a: Value | Value[], b: Value | Value[]): number {
  return compareJsonValues(convexToJson(a), convexToJson(b))
}

// ============================================================================
// Client-Side Validation
// ============================================================================

/**
 * Error thrown when a client-only operation is attempted on the server.
 */
export class ClientOnlyError extends Error {
  constructor(operationType: 'mutation' | 'action') {
    super(`ConvexClient not available - ${operationType}s only work on client side`)
    this.name = 'ClientOnlyError'
  }
}

/**
 * Ensure we're running on the client side.
 * Throws a descriptive error if called during SSR.
 *
 * @param client - The Convex client (may be undefined on server)
 * @param operationType - Type of operation for error message
 * @throws ClientOnlyError if client is not available
 */
export function ensureClient<T>(
  client: T | undefined,
  operationType: 'mutation' | 'action',
): asserts client is T {
  if (!client) {
    throw new ClientOnlyError(operationType)
  }
}

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Validate that a string is a valid URL.
 *
 * @param url - The URL string to validate
 * @returns True if the URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Validate Convex URL format.
 * Convex URLs should be HTTPS and end with .convex.cloud or similar.
 *
 * @param url - The Convex deployment URL
 * @returns True if the URL appears to be a valid Convex URL
 */
export function isValidConvexUrl(url: string): boolean {
  if (!isValidUrl(url)) return false

  try {
    const parsed = new URL(url)
    // Must be HTTPS (Convex requires secure connections)
    if (parsed.protocol !== 'https:') return false
    // Should be a Convex domain or localhost for development
    const host = parsed.hostname
    return (
      host.endsWith('.convex.cloud') ||
      host.endsWith('.convex.site') ||
      host === 'localhost' ||
      host === '127.0.0.1'
    )
  } catch {
    return false
  }
}

// ============================================================================
// Cookie Parsing
// ============================================================================

/**
 * Parse a cookie header string into a key-value object.
 * Handles URL-encoded values and edge cases properly.
 *
 * @param cookieHeader - The Cookie header string
 * @returns Object mapping cookie names to values
 */
export function parseCookies(cookieHeader: string | null | undefined): Record<string, string> {
  if (!cookieHeader) return {}

  const cookies: Record<string, string> = {}

  for (const cookie of cookieHeader.split(';')) {
    const [rawName, ...valueParts] = cookie.split('=')
    const name = rawName?.trim()
    if (!name) continue

    // Join back in case value contains '='
    const value = valueParts.join('=').trim()

    try {
      // Decode URL-encoded values
      cookies[name] = decodeURIComponent(value)
    } catch {
      // If decoding fails, use raw value
      cookies[name] = value
    }
  }

  return cookies
}

/**
 * Get a specific cookie value from a cookie header string.
 *
 * @param cookieHeader - The Cookie header string
 * @param name - The cookie name to retrieve
 * @returns The cookie value or null if not found
 */
export function getCookie(cookieHeader: string | null | undefined, name: string): string | null {
  const cookies = parseCookies(cookieHeader)
  return cookies[name] ?? null
}

/**
 * Check if a specific cookie exists in the cookie header.
 *
 * @param cookieHeader - The Cookie header string
 * @param name - The cookie name to check
 * @returns True if the cookie exists
 */
export function hasCookie(cookieHeader: string | null | undefined, name: string): boolean {
  return getCookie(cookieHeader, name) !== null
}

// ============================================================================
// Instance ID Management (WeakMap-based)
// ============================================================================

// WeakMap for pagination instance tracking (auto-cleans when component unmounts)
const instanceIdMap = new WeakMap<object, number>()
let globalInstanceCounter = 0

/**
 * Get or create a unique instance ID for an object.
 * Uses WeakMap for automatic garbage collection when the object is destroyed.
 *
 * @param instance - The object to get an ID for (typically a component instance or ref)
 * @returns A unique numeric ID for this instance
 */
export function getInstanceId(instance: object): number {
  let id = instanceIdMap.get(instance)
  if (id === undefined) {
    id = ++globalInstanceCounter
    instanceIdMap.set(instance, id)
  }
  return id
}

/**
 * Generate a new unique pagination ID.
 * Each call returns a new ID, suitable for cache-busting.
 *
 * @returns A unique numeric ID
 */
export function generatePaginationId(): number {
  return ++globalInstanceCounter
}
