import { BrowserWindow } from 'electron'
import { dicomParserHandlers } from './handlers/dicomParserIpcHandlers'

export function setupIpcHandlers(mainWindow: BrowserWindow): void {
  dicomParserHandlers(mainWindow)
}
