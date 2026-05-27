import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const localA11y = {
  rules: {
    'icon-button-name': {
      meta: {
        type: 'problem',
        docs: { description: 'Require an accessible name on icon-only buttons' },
        messages: { missingName: 'Icon-only buttons must include aria-label, aria-labelledby, or title.' },
      },
      create(context) {
        const attrName = attr => attr?.name?.name || attr?.name?.name?.name
        const hasAccessibleName = attrs => attrs.some(attr => ['aria-label', 'aria-labelledby', 'title'].includes(attrName(attr)))
        const isIgnorableText = child => child.type === 'JSXText' && child.value.trim().length === 0
        const isSvgElement = child => child.type === 'JSXElement' && child.openingElement?.name?.name === 'svg'
        const isDefinitelyIconOnly = children => {
          const meaningful = children.filter(child => !isIgnorableText(child))
          return meaningful.length > 0 && meaningful.every(isSvgElement)
        }
        return {
          JSXElement(node) {
            const opening = node.openingElement
            if (opening?.name?.name !== 'button') return
            if (hasAccessibleName(opening.attributes || [])) return
            if (!isDefinitelyIconOnly(node.children)) return
            context.report({ node: opening.name, messageId: 'missingName' })
          },
        }
      },
    },
  },
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      localA11y,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'localA11y/icon-button-name': 'error',
    },
  },
])
