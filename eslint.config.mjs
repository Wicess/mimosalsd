import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

/** eslint-config-next v16 ships native flat configs — no FlatCompat needed. */
const config = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'src/generated/**',
      'next-env.d.ts',
      // Playwright harness: short-circuit assertions are the intended style.
      'tests/e2e/**',
    ],
  },
]

export default config
