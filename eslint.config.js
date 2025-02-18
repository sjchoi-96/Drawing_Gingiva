import vue from 'eslint-plugin-vue'
import typescriptPlugin from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import vueParser from 'vue-eslint-parser'

export default [
  {
    // Vue 파일용 설정
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: typescriptParser,
        extraFileExtensions: ['.vue']
      }
    },
    plugins: { vue },
    rules: {
      ...vue.configs['vue3-recommended'].rules,
      // 컴포넌트 이름 규칙
      'vue/component-name-in-template-casing': ['error', 'PascalCase'], // <MyComponent /> 형식 강제
      'vue/multi-word-component-names': 'off', // 한 단어 컴포넌트 이름 허용
      // 템플릿 문법
      'vue/no-v-html': 'warn', // XSS 취약점 가능성 경고
      'vue/no-unused-vars': 'warn', // 사용하지 않는 변수 경고
      'vue/require-v-for-key': 'error', // v-for에 key 필수
      // 속성 순서
      'vue/attributes-order': [
        'error',
        {
          order: [
            'DEFINITION',
            'LIST_RENDERING',
            'CONDITIONALS',
            'RENDER_MODIFIERS',
            'GLOBAL',
            ['UNIQUE', 'SLOT'],
            'TWO_WAY_BINDING',
            'OTHER_DIRECTIVES',
            'OTHER_ATTR',
            'EVENTS',
            'CONTENT'
          ]
        }
      ],

      // 컴포넌트 내부 순서
      'vue/component-tags-order': [
        'error',
        {
          order: ['script', 'template', 'style']
        }
      ]
    }
  },
  {
    // preload 폴더의 TypeScript 파일
    files: ['**/preload/**/*.ts'],
    languageOptions: {
      parser: typescriptParser
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin
    },
    rules: {
      ...typescriptPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/explicit-function-return-type': 'warn'
    }
  },
  {
    // 그 외 TypeScript 파일
    files: ['**/*.ts'],
    ignores: ['**/preload/**/*.ts'],
    languageOptions: {
      parser: typescriptParser
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin
    },
    rules: {
      ...typescriptPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'warn'
    }
  },
  {
    // 일반
    files: ['**/*.js'],
    languageOptions: {
      parser: typescriptParser
    },
    rules: {
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off'
    }
  }
]
