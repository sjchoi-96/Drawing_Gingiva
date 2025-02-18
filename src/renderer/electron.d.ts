import type { DicomVolumeData } from '../types/dicom'
interface DicomParserAPI {
  selectDicomFolder: () => Promise<string[] | null>
  loadDicomFiles: (dcmFiles: object) => Promise<DicomVolumeData>
}

declare global {
  interface Window {
    dicomParserAPI: DicomParserAPI
  }
}

export {}

