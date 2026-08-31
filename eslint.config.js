import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // docs/carbo.js is the minified build output, not source.
  { ignores: ['dist/**', 'docs/carbo.js', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // The demo page: plain browser JavaScript, no TypeScript project behind it.
    files: ['docs/**/*.js'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        Date: 'readonly',
      },
    },
  },
);
