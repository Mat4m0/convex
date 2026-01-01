# Changelog

All notable changes to this project will be documented in this file.

## v0.1.8

[compare changes](https://github.com/lupinum-dev/better-convex-nuxt/compare/v0.1.7...v0.1.8)

### 🩹 Fixes

- Update import path for useRuntimeConfig to use nitropack/runtime ([30fbc75](https://github.com/lupinum-dev/better-convex-nuxt/commit/30fbc75))

### 🏡 Chore

- **release:** V0.1.7 ([4bbcc22](https://github.com/lupinum-dev/better-convex-nuxt/commit/4bbcc22))

### ❤️ Contributors

- Mat4m0 <matthias.amon@me.com>

## v0.1.7

[compare changes](https://github.com/lupinum-dev/better-convex-nuxt/compare/v0.1.6...v0.1.7)

### 💅 Refactors

- Remove unused imports and enhance logger documentation ([9960d0a](https://github.com/lupinum-dev/better-convex-nuxt/commit/9960d0a))

### 🏡 Chore

- **release:** V0.1.6 ([b49b9f4](https://github.com/lupinum-dev/better-convex-nuxt/commit/b49b9f4))

### ❤️ Contributors

- Mat4m0 <matthias.amon@me.com>

## v0.1.6

[compare changes](https://github.com/lupinum-dev/better-convex-nuxt/compare/v0.1.5...v0.1.6)

### 🩹 Fixes

- Replace $fetch with fetch in API calls and update package.json for server types ([2dae71c](https://github.com/lupinum-dev/better-convex-nuxt/commit/2dae71c))

### 💅 Refactors

- Update index.md for improved structure and formatting ([b039ad2](https://github.com/lupinum-dev/better-convex-nuxt/commit/b039ad2))

### 🏡 Chore

- Remove vite override from package.json ([c144828](https://github.com/lupinum-dev/better-convex-nuxt/commit/c144828))
- Add TypeScript configuration extending Nuxt settings ([81031bf](https://github.com/lupinum-dev/better-convex-nuxt/commit/81031bf))

### ❤️ Contributors

- Mat4m0 <matthias.amon@me.com>

## v0.1.5

[compare changes](https://github.com/lupinum-dev/better-convex-nuxt/compare/v0.1.3...v0.1.5)

### 🏡 Chore

- **release:** V0.1.3 ([06d53b0](https://github.com/lupinum-dev/better-convex-nuxt/commit/06d53b0))

### ❤️ Contributors

- Mat4m0 <matthias.amon@me.com>

## v0.1.3

[compare changes](https://github.com/lupinum-dev/better-convex-nuxt/compare/v0.1.1...v0.1.3)

### 🏡 Chore

- **release:** V0.1.1 ([cd00ff4](https://github.com/lupinum-dev/better-convex-nuxt/commit/cd00ff4))

### ❤️ Contributors

- Mat4m0 <matthias.amon@me.com>

## v0.1.1


### 🩹 Fixes

- Lint ([ab6c72e](https://github.com/lupinum-dev/better-convex-nuxt/commit/ab6c72e))
- Update navigation link for getting started section ([849b4cc](https://github.com/lupinum-dev/better-convex-nuxt/commit/849b4cc))

### 💅 Refactors

- Improve type safety and simplify method retrieval in auth API handler ([1c78346](https://github.com/lupinum-dev/better-convex-nuxt/commit/1c78346))

### 🏡 Chore

- Update ESLint configuration to allow self-closing void elements and apply consistent self-closing syntax in Vue components ([ef1a804](https://github.com/lupinum-dev/better-convex-nuxt/commit/ef1a804))
- Update playground configurations to not typecheck for now ([f587ce7](https://github.com/lupinum-dev/better-convex-nuxt/commit/f587ce7))
- Prepare first release ([7003857](https://github.com/lupinum-dev/better-convex-nuxt/commit/7003857))

### ❤️ Contributors

- Mat4m0 <matthias.amon@me.com>

## [Unreleased]

### Added

- Initial release
- Real-time queries with SSR support (`useConvexQuery`, `useLazyConvexQuery`)
- Mutations with optimistic updates (`useConvexMutation`)
- Actions support (`useConvexAction`)
- Paginated queries (`useConvexPaginatedQuery`)
- Authentication integration with Better Auth (`useConvexAuth`, `useAuthClient`)
- Permission system (`createPermissions`)
- Connection state monitoring (`useConvexConnectionState`)
- Cached query access (`useConvexCached`)
- Server utilities (`fetchQuery`, `fetchMutation`, `fetchAction`)
- Auth components (`ConvexAuthenticated`, `ConvexUnauthenticated`, `ConvexAuthLoading`)
- Full TypeScript support with Convex schema inference
