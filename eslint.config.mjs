import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextVitals,
  ...nextTypeScript,
  {
    ignores: [
      '.next/**',
      '.next.cache-broken-*/**',
      'out/**',
      'build/**',
    ],
  },
  {
    name: 'admin/lint-debt-ratchet',
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-namespace': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      '@typescript-eslint/no-this-alias': 'warn',
      '@typescript-eslint/no-wrapper-object-types': 'warn',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react/display-name': 'warn',
    },
  },
  {
    name: 'admin/legacy-scripts-ratchet',
    files: [
      'scripts/**/*.js',
      'docker/**/*.js',
    ],
    rules: {
      '@next/next/no-assign-module-variable': 'warn',
    },
  },
];

export default eslintConfig;
