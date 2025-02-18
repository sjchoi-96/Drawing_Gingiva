import { loadDicomFiles } from '../utils/dicomParser/dicomUtils'
import type { DicomVolumeData } from '../../types/dicom'

class DicomVolumeLoaderService {
  async loadDicomSlices(dcmFiles: string[]): Promise<DicomVolumeData> {
    try {
      console.log('Loading DICOM files:', dcmFiles)
      if (!dcmFiles || dcmFiles.length === 0) {
        throw new Error('No DICOM files provided')
      }
      // console.log('loadDicomSlices in')
      const slices = await loadDicomFiles(dcmFiles)
      // console.log('Parsed slices:', slices)
      const firstSlice = slices[0]

      const dicomVolumeData: DicomVolumeData = {
        slices,
        dimensions: {
          width: firstSlice.columns,
          height: firstSlice.rows,
          depth: slices.length
        },
        spacing: [
          firstSlice.pixelSpacing?.[0] || 1.0, // x축 방향의 픽셀 간격(mm)
          firstSlice.pixelSpacing?.[1] || 1.0, // y축 방향의 픽셀 간격(mm)
          firstSlice.sliceThickness || 1.0 // z축 방향의 픽셀 간격(mm)
        ]
      }
      return dicomVolumeData
    } catch (error) {
      console.error('Error loading DICOM slices:', error)
      throw error
    }
  }
}

// 싱글톤 인스턴스 생성 및 export
export const dicomVolumeLoaderService = new DicomVolumeLoaderService()

// dicomVolumeData 타입은?
// DicomVolumeData {
//   slices: DicomSlice[
//     pixelData: Int16Array
//     rows: number
//     columns: number
//     sliceLocation: number
//     pixelSpacing?: [number, number]
//     sliceThickness?: number
//     imagePosition?: [number, number, number]
//     metadata?: {
//        patientName?: string
//        patientId?: string
//        seriesDescription?: string
//        windowCenter?: number
//        windowWidth?: number
//        instanceNumber?: number
//      }
//   ],
// dimensions: {
//   width: number
//   height: number
//   depth: number
// }
// spacing: [number, number, number]
// }
