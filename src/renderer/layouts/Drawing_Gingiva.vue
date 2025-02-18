<script setup lang="ts">
  // Three.js 임포트 추가
  import * as THREE from 'three'
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
  import { STLReader } from '../services/STLReader'
  import { PLYReader } from '../services/PLYReader'

  // 상수 정의
  const CONSTANTS = {
    CAMERA: {
      FOV: 75,
      POSITION: { x: 10, y: 10, z: 10 }
    },
    RESAMPLING: {
      TARGET_POINTS: 1000, // 목표 포인트 수
      GRID_RESOLUTION: 100, // 그리드 해상도
      NEIGHBOR_SEARCH_RADIUS: 0.5, // 인접점 검색 반경
      INTERPOLATION_STEPS: 5 // 보간 단계 수
    }
  }

  // 메쉬 저장을 위한 전역 변수 추가
  const meshes = {
    stl: null as THREE.Mesh | null,
    ply: null as (THREE.Mesh | THREE.Group) | null
  }

  let currentScene: THREE.Scene | null = null
  let currentCamera: THREE.PerspectiveCamera | null = null
  let currentRenderer: THREE.WebGLRenderer | null = null

  // 파일 로드 함수
  async function loadFile(
    fileType: 'stl' | 'ply'
  ): Promise<THREE.BufferGeometry | THREE.Vector3[]> {
    try {
      if (fileType === 'stl') {
        return await loadSTLFile()
      } else {
        const geometry = await loadPLYFile()
        const vertices = new Float32Array(geometry.getAttribute('position').array)
        return resamplePointCloud(vertices)
      }
    } catch (error) {
      console.error(`${fileType.toUpperCase()} 파일 로드 중 오류 발생:`, error)
      throw error
    }
  }

  // 3D 시각화 함수
  function createProcessedPointGroup(
    originalPoints: THREE.Vector3[],
    windowSize: number,
    yOffset: number,
    color: number
  ): THREE.Group {
    const sphereGeometry = new THREE.SphereGeometry(0.2, 8, 8)
    const sphereMaterial = new THREE.MeshPhongMaterial({ color })
    const group = new THREE.Group()

    // 이동평균 필터 적용
    const processedPoints = applyMovingAverageFilter(originalPoints, windowSize)

    // 포인트 생성 및 y축 평행이동
    processedPoints.forEach((point) => {
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
      sphere.position.copy(point)
      sphere.position.y += yOffset
      group.add(sphere)
    })

    return group
  }

  function visualizeGeometry(
    geometry: THREE.BufferGeometry | THREE.Vector3[],
    fileType: 'stl' | 'ply'
  ) {
    if (fileType === 'stl') {
      const material = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        specular: 0x111111,
        shininess: 200,
        transparent: true,
        opacity: 0.4
      })
      const mesh = new THREE.Mesh(geometry as THREE.BufferGeometry, material)

      if (meshes[fileType]) {
        currentScene?.remove(meshes[fileType]!)
      }
      meshes[fileType] = mesh
      currentScene?.add(mesh)
    } else {
      if (meshes['ply']) {
        currentScene?.remove(meshes['ply']!)
      }

      const points = geometry as THREE.Vector3[]
      const processedPoints = interpolateAndResamplePoints(points)
      const pointsGroup = new THREE.Group()

      // 원본 포인트 (빨간색)
      const redGroup = createProcessedPointGroup(processedPoints, 1, 0, 0xff0000)
      pointsGroup.add(redGroup)

      // 5점 이동평균 (연두색)
      const greenGroup = createProcessedPointGroup(processedPoints, 5, 5, 0x90ee90)
      pointsGroup.add(greenGroup)

      // 10점 이동평균 (파란색)
      const blueGroup = createProcessedPointGroup(processedPoints, 10, 10, 0x0000ff)
      pointsGroup.add(blueGroup)

      // 15점 이동평균 (주황색)
      const orangeGroup = createProcessedPointGroup(processedPoints, 15, 15, 0xffa500)
      pointsGroup.add(orangeGroup)

      // 20점 이동평균 (노란색)
      const yellowGroup = createProcessedPointGroup(processedPoints, 20, 30, 0xffff00)
      yellowGroup.children.forEach((sphere) => {
        sphere.position.y = 30
      })
      pointsGroup.add(yellowGroup)

      // 포인트 그룹들 간의 연결선 생성
      const connectGroups = (group1: THREE.Group, group2: THREE.Group) => {
        const points1 = group1.children
        const points2 = group2.children

        for (let i = 0; i < Math.min(points1.length, points2.length); i++) {
          const point1 = points1[i].position
          const point2 = points2[i].position

          const geometry = new THREE.BufferGeometry()
          const vertices = new Float32Array([
            point1.x,
            point1.y,
            point1.z,
            point2.x,
            point2.y,
            point2.z
          ])

          geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
          const material = new THREE.LineBasicMaterial({
            color: 0x808080,
            opacity: 0.5,
            transparent: true
          })
          const line = new THREE.Line(geometry, material)
          pointsGroup.add(line)
        }
      }
      // 빨간색-연두색 연결
      connectGroups(redGroup, greenGroup)
      // 연두색-파란색 연결
      connectGroups(greenGroup, blueGroup)
      // 파란색-주황색 연결
      connectGroups(blueGroup, orangeGroup)
      // 주황색-노란색 연결
      connectGroups(orangeGroup, yellowGroup)

      meshes['ply'] = pointsGroup
      currentScene?.add(pointsGroup)
    }
  }

  // 메인 함수
  async function loadAndProcessFile(containerId: string, fileType: 'stl' | 'ply') {
    try {
      const container = document.getElementById(containerId)
      if (!container) return console.error('Container not found')

      // scene 초기화
      if (!currentScene) {
        initializeScene(container)
      }

      // 파일 로드 및 시각화
      const geometry = await loadFile(fileType)
      visualizeGeometry(geometry, fileType)
    } catch (error) {
      console.error(`${fileType.toUpperCase()} 처리 중 오류 발생:`, error)
    }
  }

  // scene 초기화 함수
  function initializeScene(container: HTMLElement) {
    const sceneSetup = setupScene(container)
    currentScene = sceneSetup.scene
    currentCamera = sceneSetup.camera
    currentRenderer = sceneSetup.renderer

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(1, 1, 1)
    currentScene.add(ambientLight)
    currentScene.add(directionalLight)

    setupCoordinateSystem(currentScene)

    currentCamera.position.set(
      CONSTANTS.CAMERA.POSITION.x,
      CONSTANTS.CAMERA.POSITION.y,
      CONSTANTS.CAMERA.POSITION.z
    )
    currentCamera.lookAt(0, 0, 0)

    const controls = new OrbitControls(currentCamera, currentRenderer.domElement)
    controls.enableDamping = true

    function animate() {
      requestAnimationFrame(animate)
      controls.update()
      if (currentScene && currentCamera && currentRenderer) {
        currentRenderer.render(currentScene, currentCamera)
      }
    }
    animate()
  }

  // STL 파일 로드 함수
  async function loadSTLFile(): Promise<THREE.BufferGeometry> {
    const stlReader = new STLReader()
    const file = await stlReader.openFileDialog()
    if (!file) throw new Error('파일이 선택되지 않았습니다')
    const result = await stlReader.readSTLFile(file)
    return result.geometry
  }

  // PLY 파일 로드 함수
  async function loadPLYFile(): Promise<THREE.BufferGeometry> {
    const plyReader = new PLYReader()
    const file = await plyReader.openFileDialog()
    if (!file) throw new Error('파일이 선택되지 않았습니다')
    return await plyReader.readPLYFile(file)
  }

  // 유틸리티 함수들
  const createLabel = (text: string): THREE.Sprite => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = 128
    canvas.height = 128

    if (context) {
      context.fillStyle = '#ffffff'
      context.font = 'bold 64px Arial'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(text, 64, 64)
    }

    const texture = new THREE.CanvasTexture(canvas)
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.scale.set(1, 1, 1)
    return sprite
  }

  const setupScene = (container: HTMLElement) => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      CONSTANTS.CAMERA.FOV,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    )
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(container.clientWidth, container.clientHeight)

    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    return { scene, camera, renderer }
  }

  const setupCoordinateSystem = (scene: THREE.Scene): void => {
    const axesHelper = new THREE.AxesHelper(3)
    scene.add(axesHelper)

    const axesLabels = ['X', 'Y', 'Z']
    const labelPositions = [
      new THREE.Vector3(3.2, 0, 0),
      new THREE.Vector3(0, 3.2, 0),
      new THREE.Vector3(0, 0, 3.2)
    ]

    axesLabels.forEach((text, index) => {
      const sprite = createLabel(text)
      sprite.position.copy(labelPositions[index])
      scene.add(sprite)
    })
  }

  // 포인트 클라우드 리샘플링 함수 추가
  function resamplePointCloud(vertices: Float32Array): THREE.Vector3[] {
    const points: THREE.Vector3[] = []

    // 원본 포인트들을 Vector3 배열로 변환
    for (let i = 0; i < vertices.length; i += 3) {
      points.push(new THREE.Vector3(vertices[i], vertices[i + 1], vertices[i + 2]))
    }

    // 바운딩 박스 계산
    const bbox = new THREE.Box3().setFromPoints(points)
    const size = new THREE.Vector3()
    bbox.getSize(size)

    // 그리드 셀 크기 계산
    const cellSize = Math.max(size.x, size.y, size.z) / CONSTANTS.RESAMPLING.GRID_RESOLUTION

    // 그리드 기반 리샘플링
    const gridMap = new Map<string, THREE.Vector3[]>()

    points.forEach((point) => {
      const gridX = Math.floor(point.x / cellSize)
      const gridY = Math.floor(point.y / cellSize)
      const gridZ = Math.floor(point.z / cellSize)
      const key = `${gridX},${gridY},${gridZ}`

      if (!gridMap.has(key)) {
        gridMap.set(key, [])
      }
      gridMap.get(key)!.push(point)
    })

    // 각 그리드 셀에서 중심점 계산
    const resampledPoints: THREE.Vector3[] = []

    gridMap.forEach((cellPoints) => {
      const center = new THREE.Vector3()
      cellPoints.forEach((p) => center.add(p))
      center.divideScalar(cellPoints.length)
      resampledPoints.push(center)
    })

    // 목표 포인트 수에 맞게 샘플링
    const stride = Math.max(
      1,
      Math.floor(resampledPoints.length / CONSTANTS.RESAMPLING.TARGET_POINTS)
    )
    return resampledPoints.filter((_, index) => index % stride === 0)
  }

  // 이동평균 필터 함수 추가
  function applyMovingAverageFilter(points: THREE.Vector3[], windowSize: number): THREE.Vector3[] {
    const filteredPoints: THREE.Vector3[] = []

    points.forEach((point) => {
      // 현재 포인트와 다른 모든 포인트 사이의 거리 계산 및 정렬
      const sortedPoints = points
        .filter((p) => p !== point)
        .map((p) => ({
          point: p,
          distance: point.distanceTo(p)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, windowSize - 1) // 가장 가까운 9개 포인트 선택 (현재 포인트 포함 총 10개)
        .map((p) => p.point)

      // 현재 포인트와 가장 가까운 9개 포인트의 평균 계산
      const averagePoint = new THREE.Vector3()
      averagePoint.add(point) // 현재 포인트 추가
      sortedPoints.forEach((p) => averagePoint.add(p))
      averagePoint.divideScalar(Math.min(windowSize, sortedPoints.length + 1))

      filteredPoints.push(averagePoint)
    })

    return filteredPoints
  }

  // 포인트 클라우드 처리를 위한 새로운 함수들 추가
  function findNearestNeighbors(
    point: THREE.Vector3,
    points: THREE.Vector3[],
    radius: number
  ): THREE.Vector3[] {
    return points.filter((p) => p !== point && point.distanceTo(p) <= radius)
  }

  function linearInterpolate(p1: THREE.Vector3, p2: THREE.Vector3, t: number): THREE.Vector3 {
    return new THREE.Vector3(
      p1.x + (p2.x - p1.x) * t,
      p1.y + (p2.y - p1.y) * t,
      p1.z + (p2.z - p1.z) * t
    )
  }

  function interpolateAndResamplePoints(points: THREE.Vector3[]): THREE.Vector3[] {
    const interpolatedPoints: THREE.Vector3[] = [...points]

    // 각 포인트에 대해 인접점을 찾고 보간점 추가
    points.forEach((point) => {
      const neighbors = findNearestNeighbors(
        point,
        points,
        CONSTANTS.RESAMPLING.NEIGHBOR_SEARCH_RADIUS
      )

      neighbors.forEach((neighbor) => {
        // 두 점 사이에 보간점 추가
        for (let step = 1; step < CONSTANTS.RESAMPLING.INTERPOLATION_STEPS; step++) {
          const t = step / CONSTANTS.RESAMPLING.INTERPOLATION_STEPS
          const interpolatedPoint = linearInterpolate(point, neighbor, t)
          interpolatedPoints.push(interpolatedPoint)
        }
      })
    })

    // 리샘플링하여 목표 포인트 수로 줄이기
    return resamplePointCloud(new Float32Array(interpolatedPoints.flatMap((p) => [p.x, p.y, p.z])))
  }
</script>

<template>
  <div class="visualization-container">
    <div class="viz-wrapper">
      <div id="stl-viewer" class="visualization"></div>
      <div class="file-buttons">
        <button class="load-file-btn" @click="loadAndProcessFile('stl-viewer', 'stl')">
          STL 파일 불러오기
        </button>
        <button class="load-file-btn" @click="loadAndProcessFile('stl-viewer', 'ply')">
          PLY 파일 불러오기
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .visualization-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 20px;
    margin: 20px;
    width: 100%;
    height: 600px;
  }

  .viz-wrapper {
    display: flex;
    flex-direction: column;
    width: 45%;
    min-width: 400px;
  }

  .visualization {
    height: 550px;
    border: 1px solid #000000;
    border-radius: 4px;
    overflow: hidden;
  }

  .legend {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-top: 10px;
    padding: 5px;
    background-color: rgba(117, 115, 115, 0.9);
    border-radius: 4px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .color-box {
    width: 12px;
    height: 12px;
    border-radius: 2px;
  }

  .blue {
    background-color: #0000ff;
  }
  .green {
    background-color: #00ff00;
  }
  .yellow {
    background-color: #ffff00;
  }

  .file-buttons {
    display: flex;
    gap: 10px;
    margin-top: 10px;
  }

  .load-file-btn {
    flex: 1;
    padding: 8px 16px;
    background-color: #4caf50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.3s;
  }

  .load-file-btn:hover {
    background-color: #45a049;
  }

  .load-file-btn:active {
    background-color: #3d8b40;
  }
</style>

