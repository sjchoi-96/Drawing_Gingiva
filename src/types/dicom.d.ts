export interface DicomSlice {
  pixelData: Int16Array
  rows: number
  columns: number
  sliceLocation: number
  pixelSpacing?: [number, number]
  sliceThickness?: number
  imagePosition?: [number, number, number]
  metadata?: {
    patientName?: string
    patientId?: string
    seriesDescription?: string
    windowCenter?: number
    windowWidth?: number
    instanceNumber?: number
  }
}

export interface DicomVolumeData {
  slices: DicomSlice[]
  dimensions: {
    width: number
    height: number
    depth: number
  }
  spacing: [number, number, number]
}
