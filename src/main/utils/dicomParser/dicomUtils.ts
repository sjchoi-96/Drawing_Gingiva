import dicomParser from 'dicom-parser'
import fs from 'node:fs/promises'
import { DICOM_TAGS } from './dicomTags'

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

/**
 * DICOM 파일들을 로드하고 파싱하는 메인 함수
 * @param filePaths DICOM 파일 경로 배열
 * @returns DicomSlice 배열 (각 슬라이스의 픽셀 데이터와 메타데이터를 포함)
 */
export async function loadDicomFiles(filePaths: string[]): Promise<DicomSlice[]> {
  const imageDataArray: DicomSlice[] = []

  // 배치 크기 설정
  const RENDER_SETTINGS = {
    BATCH_SIZE: 10
  }

  for (let i = 0; i < filePaths.length; i += RENDER_SETTINGS.BATCH_SIZE) {
    const batchPaths = filePaths.slice(i, i + RENDER_SETTINGS.BATCH_SIZE)
    const batchBuffers = await Promise.all(batchPaths.map((path) => fs.readFile(path)))
    const batchImageData = await Promise.all(
      batchBuffers.map((buffer) => processDicomBuffer(buffer))
    )
    imageDataArray.push(...batchImageData)
  }

  return imageDataArray.sort((a, b) => a.sliceLocation - b.sliceLocation)
}

async function processDicomBuffer(buffer: Buffer): Promise<DicomSlice> {
  const byteArray = new Uint8Array(buffer)
  const dataSet = dicomParser.parseDicom(byteArray)

  const pixelDataElement = dataSet.elements[DICOM_TAGS.PIXEL_DATA]
  const pixelData = new Int16Array(
    dataSet.byteArray.buffer,
    pixelDataElement.dataOffset,
    pixelDataElement.length / 2
  )

  const pixelSpacing = dataSet.string(DICOM_TAGS.PIXEL_SPACING)?.split('\\').map(Number) as [
    number,
    number
  ]

  const imagePosition = dataSet.string(DICOM_TAGS.IMAGE_POSITION)?.split('\\').map(Number) as [
    number,
    number,
    number
  ]

  return {
    pixelData,
    rows: dataSet.uint16(DICOM_TAGS.ROWS) || 0,
    columns: dataSet.uint16(DICOM_TAGS.COLUMNS) || 0,
    sliceLocation: dataSet.floatString(DICOM_TAGS.SLICE_LOCATION) || 0,
    pixelSpacing,
    sliceThickness: dataSet.floatString(DICOM_TAGS.SLICE_THICKNESS),
    imagePosition,
    metadata: {
      patientName: dataSet.string(DICOM_TAGS.PATIENT_NAME),
      patientId: dataSet.string(DICOM_TAGS.PATIENT_ID),
      seriesDescription: dataSet.string(DICOM_TAGS.SERIES_DESCRIPTION),
      windowCenter: dataSet.floatString(DICOM_TAGS.WINDOW_CENTER),
      windowWidth: dataSet.floatString(DICOM_TAGS.WINDOW_WIDTH),
      instanceNumber: parseInt(dataSet.string(DICOM_TAGS.INSTANCE_NUMBER) || '0')
    }
  }
}

export async function sortDicomFiles(files: File[]): Promise<File[]> {
  const fileInfos = await Promise.all(
    files.map(async (file) => {
      const metadata = await readDicomMetadata(file)
      return {
        file,
        instanceNumber: metadata.instanceNumber,
        imagePosition: metadata.imagePosition
      }
    })
  )

  return fileInfos
    .sort((a, b) => {
      // Instance Number로 정렬
      if (a.instanceNumber !== undefined && b.instanceNumber !== undefined) {
        return a.instanceNumber - b.instanceNumber
      }
      // Image Position으로 정렬 (Z축 기준)
      if (a.imagePosition && b.imagePosition) {
        return a.imagePosition[2] - b.imagePosition[2]
      }
      return 0
    })
    .map((info) => info.file)
}

interface DicomMetadata {
  instanceNumber: number
  imagePosition?: [number, number, number]
}

async function readDicomMetadata(file: File): Promise<DicomMetadata> {
  const arrayBuffer = await file.arrayBuffer()
  const byteArray = new Uint8Array(arrayBuffer)
  const dataSet = dicomParser.parseDicom(byteArray)

  return {
    instanceNumber: parseInt(dataSet.string(DICOM_TAGS.INSTANCE_NUMBER) || '0'),
    imagePosition: dataSet.string(DICOM_TAGS.IMAGE_POSITION)?.split('\\').map(Number) as [
      number,
      number,
      number
    ]
  }
}
