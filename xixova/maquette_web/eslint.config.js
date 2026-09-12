import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {ignores:['dist/**','test-results/**','playwright-report/**','public/**']},
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {files:['**/*.{ts,tsx}'],languageOptions:{globals:{...globals.browser,...globals.node}},rules:{
    '@typescript-eslint/no-explicit-any':'off',
    '@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}],
    '@typescript-eslint/no-unused-expressions':'off',
    'no-useless-escape':'off',
    'no-empty':['error',{allowEmptyCatch:true}],
  }},
);
