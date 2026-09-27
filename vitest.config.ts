import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Scope to source only. Without this the provider tries to resolve source maps
      // from .next build output and crashes.
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/compliance/index.ts', // barrel: re-exports only, no behaviour
        'src/lib/db/**', // Prisma singleton: covered by integration, not unit tests
        // Thin wrappers over next/headers and fetch. The logic they wrap
        // (parseCartCookie, resolveHandle) is pure and IS covered.
        'src/lib/cart/storage.ts',
        'src/lib/geo/**',
        'src/lib/notify/**',
      ],
      reporter: ['text-summary', 'text'],
      // These modules carry money and legal exposure. They are held to a higher bar.
      thresholds: {
        'src/lib/compliance/**': {
          lines: 95,
          functions: 95,
          branches: 90,
          statements: 95,
        },
        // Pricing, cart splitting and order state carry money and legal exposure.
        'src/lib/cart/**': { lines: 90, functions: 90, branches: 85, statements: 90 },
        'src/lib/orders/**': { lines: 90, functions: 90, branches: 80, statements: 90 },
        'src/lib/catalog/**': { lines: 90, functions: 90, branches: 85, statements: 90 },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // See tests/stubs/server-only.ts for why this is stubbed rather than removed.
      'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
})
