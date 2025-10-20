module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json', './tsconfig.node.json', './tsconfig.eslint.json'],
    tsconfigRootDir: __dirname,
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'jsx-a11y',
    'testing-library',
    '@vitest',
    'playwright',
    'tauri',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:tauri/recommended',
    'prettier',
  ],
  ignorePatterns: [
    'dist',
    'coverage',
    'test-results',
    'vite.config.*',
    'vitest.config.ts',
    'playwright.config.*',
    'wdio.conf.ts',
    '.eslintrc.cjs',
    'tools/**/*',
    '**/*.d.ts',
    'src/db/**/*.js',
    'src/modules/jmh/NarrativeSummaryPanel.tsx',
    // ignore Tauri build output (generated at build time)
    'src-tauri/target/**',
    'src-tauri/**/out/**',
  ],
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  overrides: [
    // Don't run the typed TypeScript parser against config or generated JS files
    {
      files: ['.eslintrc.*', 'vite.config.*', 'vite.config.*', 'wdio.conf.ts', 'playwright.config.*', 'src-tauri/**/out/**', 'src-tauri/target/**'],
      parser: 'espree',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    {
      files: ['**/*.{test,spec}.{ts,tsx}'],
      extends: ['plugin:@vitest/legacy-recommended', 'plugin:testing-library/react'],
      rules: {
        'playwright/no-conditional-in-test': 'off',
        '@vitest/expect-expect': 'off',
        'testing-library/no-manual-cleanup': 'off',
        'testing-library/prefer-screen-queries': 'off',
      },
    },
    {
      files: ['test/e2e/**/*.{ts,tsx}', 'playwright.config.{ts,tsx,js}'],
      extends: ['plugin:playwright/recommended'],
      rules: {
        'playwright/valid-expect': 'off',
      },
    },
  ],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'react-hooks/exhaustive-deps': 'off',
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/refs': 'off',
    'react-hooks/preserve-manual-memoization': 'off',
    'react-hooks/rules-of-hooks': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/triple-slash-reference': 'off',
    'no-control-regex': 'off',
    'no-useless-escape': 'off',
    'prefer-const': 'off',
    'jsx-a11y/click-events-have-key-events': 'off',
    'jsx-a11y/no-noninteractive-element-interactions': 'off',
    'complexity': ['error', { max: 20 }],
    'max-lines-per-function': [
      'error',
      { max: 120, skipBlankLines: true, skipComments: true },
    ],
    'no-nested-ternary': 'error',
  // removed deprecated rule '@typescript-eslint/no-implicit-any-catch'
  },
};
