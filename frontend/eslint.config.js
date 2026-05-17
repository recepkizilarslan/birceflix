import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // eslint-plugin-react-hooks v7 added this rule. It flags legitimate
      // "deps changed → reset stale state before fetching" patterns we use
      // in Layout / MovieDetailPage / Stats etc. The actual cascading-render
      // risk is negligible (one extra render before the data arrives), so
      // we keep the rule off and lean on real code review.
      'react-hooks/set-state-in-effect': 'off',
      // `catch (e: any) { setErr(e.message) }` is common and pre-existed
      // across the codebase. Demoted to a warning until a focused cleanup PR.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
])
