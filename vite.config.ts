import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'
import VueDevTools from 'vite-plugin-vue-devtools'
import MetaLayouts from 'vite-plugin-vue-meta-layouts'

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    'process.env': {
      LANG: JSON.stringify('ko_KR.UTF-8') // 강제 설정 추가
    }
  },
  root: 'src/renderer',
  mode: 'development',
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    VueDevTools(),
    electron([
      {
        entry: resolve(__dirname, 'src/main/index.ts'),
        vite: {
          build: {
            outDir: '../../dist-electron/main'
          }
        }
      },
      {
        entry: resolve(__dirname, 'src/preload/index.ts'),
        onstart(options): void {
          options.reload()
        },
        vite: {
          build: {
            outDir: '../../dist-electron/preload',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    ]),
    renderer(),
    MetaLayouts()
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src/renderer')
    }
  },
  build: {
    outDir: '../../dist-electron/renderer'
  }
})

