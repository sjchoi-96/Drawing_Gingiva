const { ipcRenderer } = require('electron')
import type vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData'

export const dicomParserAPI = {
  selectDicomFolder: async (): Promise<string[] | null> => {
    return await ipcRenderer.invoke('select-dicom-folder')
  },
  loadDicomFiles: async (dcmFiles: string[]): Promise<vtkImageData> => {
    console.log('Sending DICOM files to main process:', dcmFiles)
    return await ipcRenderer.invoke('load-dicom-files', dcmFiles)
  }
}
