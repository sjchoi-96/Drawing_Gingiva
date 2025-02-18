import fs from 'node:fs/promises'
import path from 'node:path'

class DicomFileService {
  constructor() {}

  async getDicomFiles(selectedFolder: Electron.OpenDialogReturnValue): Promise<string[]> {
    try {
      const isDicomFolder: boolean = await this.isDicomFile(selectedFolder)
      if (isDicomFolder) {
        const folderPath = selectedFolder.filePaths[0]
        const files = await fs.readdir(folderPath)
        const filetedFiles = this.filtedDicomFiles(files)
        // console.log('filetedFiles', filetedFiles)
        return filetedFiles.map((file) => path.join(folderPath, file))
      }
    } catch (error) {
      console.error(error)
    }
    return []
  }

  private async isDicomFile(selectedFolder: Electron.OpenDialogReturnValue): Promise<boolean> {
    let isDicomFolder = false
    if (selectedFolder.canceled || selectedFolder.filePaths.length === 0) {
      throw new Error('No folder selected')
    }
    isDicomFolder = true
    return isDicomFolder
  }

  private filtedDicomFiles(files: string[]): string[] {
    const dcmFiles = files.filter(
      (file) => file.toLowerCase().endsWith('.dcm') || file.toLowerCase().endsWith('.dicom')
    )
    return dcmFiles
  }
}

export const dicomFileService = new DicomFileService()
