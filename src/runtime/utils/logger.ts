/**
 * Shared logging utilities for better-convex-nuxt
 *
 * Provides consistent logging patterns across all composables, plugins, and utilities.
 * Logs are prefixed with context information and can be enabled/disabled via config.
 */

import type { FunctionReference } from 'convex/server'

import { getFunctionName } from './convex-cache'

/**
 * Logger function type for debug logging
 */
export type Logger = (message: string, data?: unknown) => void

/**
 * Options for creating a logger
 */
export interface LoggerOptions {
  /** Whether logging is enabled */
  verbose: boolean
  /** Prefix for log messages (e.g., '[bcn:auth]', '[useConvexQuery]') */
  prefix: string
  /** Optional function name to include in prefix (for query/mutation/action loggers) */
  functionName?: string
  /** Optional function reference to extract name from */
  functionRef?: FunctionReference<'query' | 'mutation' | 'action'>
}

/**
 * Create a logger function with consistent formatting.
 *
 * @param options - Logger configuration options
 * @returns Logger function that logs with prefix and environment info, or no-op if verbose is false
 *
 * @example
 * ```ts
 * // Simple logger
 * const log = createLogger({
 *   verbose: config.public.convex?.verbose ?? false,
 *   prefix: '[bcn:auth]',
 * })
 * log('User authenticated', { userId: '123' })
 *
 * // Function logger (for queries/mutations)
 * const log = createLogger({
 *   verbose: true,
 *   prefix: '[bcn:useConvexQuery]',
 *   functionRef: api.tasks.list,
 * })
 * log('Fetching tasks', { status: 'active' })
 * ```
 */
export function createLogger(options: LoggerOptions): Logger {
  if (!options.verbose) {
    return () => {}
  }

  // Extract function name if provided
  let fnName = options.functionName
  if (!fnName && options.functionRef) {
    try {
      fnName = getFunctionName(options.functionRef)
    } catch {
      fnName = 'unknown'
    }
  }

  // Build prefix with environment and optional function name
  const env = import.meta.server ? '[SSR]' : '[Client]'
  const basePrefix = options.prefix
  const fullPrefix = fnName ? `${basePrefix} ${env} ${fnName}: ` : `${basePrefix} ${env} `

  return (message: string, data?: unknown) => {
    if (data !== undefined) {
      console.log(fullPrefix + message, data)
    } else {
      console.log(fullPrefix + message)
    }
  }
}

/**
 * Create a logger for query composables.
 * This is a convenience wrapper around createLogger with query-specific defaults.
 *
 * @param verbose - Whether logging is enabled
 * @param composableName - Name of the composable (e.g., 'useConvexQuery')
 * @param query - The Convex query function reference
 * @returns Logger function
 *
 * @example
 * ```ts
 * const log = createQueryLogger(verbose, 'useConvexQuery', api.tasks.list)
 * // Logs will have prefix: [bcn:useConvexQuery] [SSR] tasks:list: ...
 * log('Initializing', { lazy, server })
 * ```
 */
export function createQueryLogger(
  verbose: boolean,
  composableName: string,
  query: FunctionReference<'query'>,
): Logger {
  return createLogger({
    verbose,
    prefix: `[bcn:${composableName}]`,
    functionRef: query,
  })
}

/**
 * Create a logger for mutation composables.
 *
 * @param verbose - Whether logging is enabled
 * @param composableName - Name of the composable (e.g., 'useConvexMutation')
 * @param mutation - The Convex mutation function reference
 * @returns Logger function
 */
export function createMutationLogger(
  verbose: boolean,
  composableName: string,
  mutation: FunctionReference<'mutation'>,
): Logger {
  return createLogger({
    verbose,
    prefix: `[bcn:${composableName}]`,
    functionRef: mutation,
  })
}

/**
 * Create a logger for action composables.
 *
 * @param verbose - Whether logging is enabled
 * @param composableName - Name of the composable (e.g., 'useConvexAction')
 * @param action - The Convex action function reference
 * @returns Logger function
 */
export function createActionLogger(
  verbose: boolean,
  composableName: string,
  action: FunctionReference<'action'>,
): Logger {
  return createLogger({
    verbose,
    prefix: `[bcn:${composableName}]`,
    functionRef: action,
  })
}

/**
 * Get verbose flag from runtime config with fallback.
 * This is a convenience function to avoid repeating the same pattern.
 *
 * @param config - Runtime config from useRuntimeConfig()
 * @param config.public - Public runtime config
 * @param config.public.convex - Convex-specific public config
 * @param config.public.convex.verbose - Verbose logging flag
 * @param override - Optional override value (from options)
 * @returns Whether verbose logging is enabled
 */
export function getVerboseFlag(
  config: { public?: { convex?: { verbose?: boolean } } },
  override?: boolean,
): boolean {
  return override ?? (config.public?.convex?.verbose ?? false)
}
