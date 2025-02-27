import * as THREE from 'three'
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js'

export class PLYReader {
  async openFileDialog(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.ply'
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0] || null
        resolve(file)
      }
      input.click()
    })
  }

  async readPLYFile(file: File): Promise<THREE.BufferGeometry> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const loader = new PLYLoader()
          const plyContent = event.target?.result as ArrayBuffer
          const geometry = loader.parse(plyContent)
          resolve(geometry)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }
}
