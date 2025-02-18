import { ipcMain, BrowserWindow, dialog } from 'electron'

import { dicomFileService } from '../services/dicomFileService '
import type { DicomVolumeData } from '../../types/dicom'
import { dicomVolumeLoaderService } from '../services/dicomVolumeLoader'

export function dicomParserHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('select-dicom-folder', async () => {
    try {
      const selectedFolder = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
      })

      const selectedFiles: string[] = await dicomFileService.getDicomFiles(selectedFolder)
      if (selectedFiles.length === 0) {
        return null
      }
      return selectedFiles
    } catch (error) {
      console.error(error)
      throw error
    }
  })

  ipcMain.handle(
    'load-dicom-files',
    async (_event, dcmFiles: string[]): Promise<DicomVolumeData> => {
      try {
        // console.log(typeof dcmFiles) // object

        // console.log('dicomVolumeData load start') // 확인
        const volumeData: DicomVolumeData = await dicomVolumeLoaderService.loadDicomSlices(dcmFiles)
        // console.log('ctIpcHandlers load-dicom-files volumeData DONE: ', volumeData)
        return volumeData
      } catch (error) {
        console.error('Error loading DICOM files:', error)
        throw error
      }
    }
  )
}
