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
      // The shadcn CLI sometimes writes `import { cn } from "cn"`, an
      // unrelated npm package without Tailwind class merging. Our helper
      // lives in @/lib/utils.
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'cn', message: 'Import cn from "@/lib/utils" instead.' }] },
      ],
    },
  },
  {
    // shadcn/ui components export style helpers (e.g. buttonVariants) next to
    // the component, which this Fast Refresh rule flags. That's intended.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
