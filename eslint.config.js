// Only React's hook rules, as warnings (D-320): `npm run lint` counts them and CI shows them, never failing on them.
// The `eslint-disable react-hooks/exhaustive-deps` comments in the code are read by this.
import tsParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['dist/', 'functions/', 'node_modules/', 'docs/'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
    // `@typescript-eslint/no-explicit-any` is only named by an eslint-disable comment (src/ops/registry.ts); a stand-in
    // so that comment isn't an unknown rule. Nothing else of typescript-eslint is used.
    plugins: { 'react-hooks': reactHooks, '@typescript-eslint': { rules: { 'no-explicit-any': { create: () => ({}) } } } },
    rules: {
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]
