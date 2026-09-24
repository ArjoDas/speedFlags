import js from '@eslint/js'
import ts from 'typescript-eslint'
export default ts.config(js.configs.recommended, ...ts.configs.recommended, {
  files: ['frontend/src/**/*.{ts,tsx}'],
  languageOptions: {
    globals: {
      window: 'readonly',
      document: 'readonly',
      localStorage: 'readonly',
      fetch: 'readonly',
      performance: 'readonly',
      AbortController: 'readonly',
      AbortSignal: 'readonly',
      Image: 'readonly',
      crypto: 'readonly',
      setTimeout: 'readonly',
      clearTimeout: 'readonly',
      setInterval: 'readonly',
      clearInterval: 'readonly',
      console: 'readonly',
    },
  },
})
