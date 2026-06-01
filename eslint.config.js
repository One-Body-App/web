import tseslint from 'typescript-eslint';

const noUseEffectPlugin = {
  rules: {
    'no-use-effect': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow React useEffect in the web app.',
        },
        messages: {
          noImport:
            'Do not import useEffect in web. Use derived state, event handlers, callback refs, or useSyncExternalStore.',
          noCall:
            'Do not call useEffect in web. Use derived state, event handlers, callback refs, or useSyncExternalStore.',
        },
        schema: [],
      },
      create(context) {
        const localUseEffectNames = new Set(['useEffect']);

        return {
          ImportDeclaration(node) {
            if (node.source.value !== 'react') return;
            for (const specifier of node.specifiers) {
              if (
                specifier.type === 'ImportSpecifier' &&
                specifier.imported.type === 'Identifier' &&
                specifier.imported.name === 'useEffect'
              ) {
                localUseEffectNames.add(specifier.local.name);
                context.report({ node: specifier, messageId: 'noImport' });
              }
            }
          },
          CallExpression(node) {
            if (
              node.callee.type === 'Identifier' &&
              localUseEffectNames.has(node.callee.name)
            ) {
              context.report({ node: node.callee, messageId: 'noCall' });
              return;
            }

            if (
              node.callee.type === 'MemberExpression' &&
              !node.callee.computed &&
              node.callee.object.type === 'Identifier' &&
              node.callee.object.name === 'React' &&
              node.callee.property.type === 'Identifier' &&
              node.callee.property.name === 'useEffect'
            ) {
              context.report({ node: node.callee.property, messageId: 'noCall' });
            }
          },
        };
      },
    },
  },
};

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      onebody: noUseEffectPlugin,
    },
    rules: {
      'onebody/no-use-effect': 'error',
    },
  },
];
