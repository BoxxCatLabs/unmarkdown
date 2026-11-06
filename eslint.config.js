import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'coverage/', 'node_modules/'],
  },
  {
    files: ['**/*.ts', '*.js'],
    extends: [tseslint.configs.recommended],
  },
);
