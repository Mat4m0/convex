import ConvexModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [ConvexModule],
  convex: {
    url: 'https://test-convex.convex.cloud',
    siteUrl: 'http://localhost:3000',
  },
})
