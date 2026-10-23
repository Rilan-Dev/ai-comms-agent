import {createRequire} from 'node:module';
const webRequire=createRequire(new URL('./apps/web/package.json',import.meta.url));
const nextRequire=createRequire(webRequire.resolve('eslint-config-next'));
const parser=nextRequire('@typescript-eslint/parser');
const typescript=nextRequire('@typescript-eslint/eslint-plugin');
const react=nextRequire('eslint-plugin-react');
const hooks=nextRequire('eslint-plugin-react-hooks');
const next=nextRequire('@next/eslint-plugin-next');

export default [
 {ignores:['**/node_modules/**','**/.next/**','**/dist/**','vendor/**','source/**','work/**']},
 {files:['apps/web/src/**/*.{ts,tsx}','apps/worker/src/**/*.ts','packages/*/src/**/*.ts'],
  languageOptions:{parser,parserOptions:{ecmaVersion:'latest',sourceType:'module',ecmaFeatures:{jsx:true}}},
  plugins:{'@typescript-eslint':typescript},
  rules:{'constructor-super':'error','no-constant-condition':'error','no-dupe-args':'error','no-dupe-keys':'error','no-duplicate-case':'error','no-unreachable':'error','no-unsafe-finally':'error','valid-typeof':'error'},
 },
 {files:['apps/web/src/**/*.{ts,tsx}'],
  plugins:{react,'react-hooks':hooks,'@next/next':next},
  settings:{react:{version:'detect'},next:{rootDir:'apps/web/'}},
  rules:{...react.configs.recommended.rules,...react.configs['jsx-runtime'].rules,...hooks.configs.recommended.rules,
   ...next.configs.recommended.rules,...next.configs['core-web-vitals'].rules,
   // TypeScript owns component prop contracts.
   'react/prop-types':'off',
  },
 },
];
