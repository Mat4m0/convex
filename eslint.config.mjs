// @ts-check
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

// Run `npx @eslint/config-inspector` to inspect the resolved config interactively
export default createConfigForNuxt({
  features: {
    // Rules for module authors
    tooling: true,
    // Rules for formatting
    stylistic: false,
  },
  dirs: {
    src: ['./playground'],
  },
}).append(
  // Disable multi-word-component-names for Nuxt special files
  {
    files: [
      '**/error.vue',
      '**/layouts/**/*.vue',
      '**/pages/index.vue',
      '**/pages/**/index.vue',
      '**/pages/[[]...slug].vue',
    ],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
)
