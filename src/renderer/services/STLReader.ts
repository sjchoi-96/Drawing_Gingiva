import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import * as THREE from 'three'

export class STLReader {
  private loader: STLLoader

  constructor() {
    this.loader = new STLLoader()
  }

  async openFileDialog(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.stl'

      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0]
        resolve(file || null)
      }

      input.click()
    })
  }

  async readSTLFile(file: File): Promise<{
    geometry: THREE.BufferGeometry
    vertices: Float32Array
    normals: Float32Array
  }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer
          const geometry = this.loader.parse(arrayBuffer)

          const vertices = geometry.getAttribute('position').array as Float32Array
          const normals = geometry.getAttribute('normal').array as Float32Array

          resolve({
            geometry,
            vertices,
            normals
          })
        } catch (error) {
          reject(error)
        }
      }

      reader.onerror = () => reject(new Error('파일을 읽는 중 오류가 발생했습니다.'))
      reader.readAsArrayBuffer(file)
    })
  }
}

