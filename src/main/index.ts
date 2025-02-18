import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setupIpcHandlers } from './ipc'

// ES 모듈에서 __dirname 얻기
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function createWindow(): void {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true,
      preload: path.join(__dirname, '../preload/index.js') // preload 스크립트 연결
    }
  })

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
    //win.loadFile(path.join(__dirname, '../../dist/renderer/index.html'))
  }

  setupIpcHandlers(win)
}

app.whenReady().then(() => {
  console.log('현재 인코딩:', process.env.LANG) // ko_KR.UTF-8 출력 확인
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

