<script setup lang="ts">
  // Three.js 임포트 추가
  import * as THREE from 'three'
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
  import { STLReader } from '../services/STLReader'
  import { PLYReader } from '../services/PLYReader'
  import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js'
  import { MeshGenerator } from '../services/TriangleMeshGen'
  import { SplineGenerator } from '../services/SplineGenerator'
  import { ControlPointFinder } from '../services/ControlPointFinder'
  import { calculateGingivalProfile } from '../services/GingivalProfile'

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

  // 메쉬와 계산된 포인트들을 저장하기 위한 전역 변수 수정
  const meshes = {
    stl: null as THREE.Mesh | THREE.Group | null,
    ply: null as THREE.Mesh | THREE.Group | null
  }

  const calculatedPoints = {
    offsetPointsLowerOuter: [] as THREE.Vector3[],
    offsetPointsLowerInner: [] as THREE.Vector3[]
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

  // 극좌표 기반 포인트 샘플링 함수
  function polarSampling(points: THREE.Vector3[], angleStep: number = 5): THREE.Vector3[] {
    const sampledPoints: THREE.Vector3[] = []

    // 각도 범위를 0-360도로 나누기
    for (let phi = 0; phi < 360; phi += angleStep) {
      const phiRad = (phi * Math.PI) / 180
      const phiRange = (angleStep * Math.PI) / 180

      // 현재 각도 범위에 있는 포인트들 찾기
      const pointsInRange = points.filter((point) => {
        const pointPhi = Math.atan2(point.z, point.x)
        const normalizedPhi = pointPhi < 0 ? pointPhi + 2 * Math.PI : pointPhi
        const angleDiff = Math.abs(normalizedPhi - phiRad)
        return angleDiff <= phiRange || Math.abs(angleDiff - 2 * Math.PI) <= phiRange
      })

      // 각도 범위 내에서 원점으로부터 가장 먼 포인트 찾기
      if (pointsInRange.length > 0) {
        const farthestPoint = pointsInRange.reduce((max, point) => {
          const distanceMax = Math.sqrt(max.x * max.x + max.z * max.z)
          const distancePoint = Math.sqrt(point.x * point.x + point.z * point.z)
          return distancePoint > distanceMax ? point : max
        })
        const sampledPoint = farthestPoint.clone()
        sampledPoint.y = 0 // y값을 0으로 설정
        sampledPoints.push(sampledPoint)
      }
    }

    return sampledPoints
  }

  // Convex Hull 생성을 위한 함수
  function createConvexHullMesh(
    points: THREE.Vector3[],
    color: number,
    opacity: number
  ): THREE.Mesh {
    const convexGeometry = new ConvexGeometry(points)

    // 외부 표면 메쉬
    const surfaceMaterial = new THREE.MeshPhongMaterial({
      color: color,
      opacity: opacity,
      transparent: true,
      side: THREE.FrontSide,
      flatShading: true
    })

    const surfaceMesh = new THREE.Mesh(convexGeometry, surfaceMaterial)

    return surfaceMesh
  }

  // STL 메쉬의 표면 좌표를 추출하는 함수
  function extractSurfacePoints(geometry: THREE.BufferGeometry): THREE.Vector3[] {
    const positions = geometry.getAttribute('position').array
    const points: THREE.Vector3[] = []

    for (let i = 0; i < positions.length; i += 3) {
      points.push(new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]))
    }

    return points
  }

  // Convex Hull 메쉬 생성을 위한 함수 수정
  function createConvexHullFromPoints(
    upperPoints: THREE.Vector3[],
    lowerPoints: THREE.Vector3[]
  ): THREE.Group {
    const group = new THREE.Group()

    // 모든 점들을 합쳐서 Convex Hull 메쉬 생성
    const allPointsForConvexHull = [...upperPoints, ...lowerPoints]
    const convexMesh = createConvexHullMesh(allPointsForConvexHull, 0xff9999, 1) // 투명도를 0.3으로 증가
    group.add(convexMesh)
    return group
  }

  // 스플라인 기반 ConvexHull 메쉬 생성 함수
  function createSplineBasedConvexHull(surfacePoints: THREE.Vector3[]): THREE.Group {
    // 극좌표 기반 샘플링
    const sampledPoints = polarSampling(surfacePoints, 1)

    // 제어점 찾기 및 시각화
    const controlPoints = ControlPointFinder.findFiveControlPoints(sampledPoints)
    const specialPointsGroup = ControlPointFinder.createSpecialPointsGroup(controlPoints)

    // 상/하단 스플라인 곡선 생성
    const splineCurveUpper = SplineGenerator.createSplineCurve(specialPointsGroup, 30)
    const splineCurveLower = SplineGenerator.createSplineCurve(specialPointsGroup, 20)

    // 오프셋 곡선 생성
    const outerOffset = 2
    const offsetPointsUpper = SplineGenerator.createOffsetSplineCurve(splineCurveUpper, outerOffset)
    const offsetPointsLower = SplineGenerator.createOffsetSplineCurve(splineCurveLower, outerOffset)

    // ConvexHull 메쉬와 점들을 포함하는 그룹 생성
    const convexHullGroup = createConvexHullFromPoints(offsetPointsUpper, offsetPointsLower)

    return convexHullGroup
  }

  // 스플라인 기반 삼각형 메쉬 생성 함수
  function createSplineBasedTriangleMesh(surfacePoints: THREE.Vector3[]): THREE.Mesh {
    // 극좌표 기반 샘플링
    const sampledPoints = polarSampling(surfacePoints, 1)

    // 제어점 찾기 및 시각화
    const controlPoints = ControlPointFinder.findFiveControlPoints(sampledPoints)
    const specialPointsGroup = ControlPointFinder.createSpecialPointsGroup(controlPoints)

    // 하단 스플라인 곡선 생성
    const splineCurveLower = SplineGenerator.createSplineCurve(specialPointsGroup, 20)

    // 오프셋 곡선 생성
    const outerOffset = 2
    const innerOffset = -10
    calculatedPoints.offsetPointsLowerOuter = SplineGenerator.createOffsetSplineCurve(
      splineCurveLower,
      outerOffset
    )
    calculatedPoints.offsetPointsLowerInner = SplineGenerator.createOffsetSplineCurve(
      splineCurveLower,
      innerOffset
    )

    const borderPointsLower = [
      ...calculatedPoints.offsetPointsLowerOuter,
      ...calculatedPoints.offsetPointsLowerInner
    ]
    // 내부 포인트 생성
    const innerPoints = MeshGenerator.generateInnerPoints(
      calculatedPoints.offsetPointsLowerInner,
      calculatedPoints.offsetPointsLowerOuter
    )

    // 삼각형 메쉬 생성
    const triangleMesh = createTriangleMeshFromPoints(borderPointsLower, innerPoints)

    return triangleMesh
  }

  // 포인트와 삼각형 사이의 최단 거리를 계산하는 함수
  function pointToTriangleDistance(
    point: THREE.Vector3,
    triangle: [THREE.Vector3, THREE.Vector3, THREE.Vector3]
  ): { distance: number; projection: THREE.Vector3 } {
    const [a, b, c] = triangle
    const ab = b.clone().sub(a)
    const ac = c.clone().sub(a)
    const normal = ab.clone().cross(ac).normalize()

    // 삼각형의 평면에 대한 점의 정사영 계산
    const pa = point.clone().sub(a)
    const projection = point.clone().sub(normal.multiplyScalar(pa.dot(normal)))

    return {
      distance: point.distanceTo(projection),
      projection: projection
    }
  }

  // 점들을 y=20 높이로 투영하고 가장 가까운 메쉬 버텍스로 이동시키는 함수
  function projectPointsToElevatedMesh(
    points: THREE.Vector3[],
    triangleMesh: THREE.Mesh
  ): THREE.Vector3[] {
    const vertices = triangleMesh.geometry.getAttribute('position')
    const vertexPoints: THREE.Vector3[] = []

    // 버텍스 배열 생성
    for (let i = 0; i < vertices.count; i++) {
      vertexPoints.push(new THREE.Vector3(vertices.getX(i), vertices.getY(i), vertices.getZ(i)))
    }

    return points.map((point) => {
      let minDistance = Infinity
      let closestVertex = point.clone()

      // 가장 가까운 버텍스 찾기
      vertexPoints.forEach((vertex) => {
        // y좌표를 20으로 설정한 임시 점 생성
        const tempPoint = new THREE.Vector3(point.x, 20, point.z)
        const tempVertex = new THREE.Vector3(vertex.x, 20, vertex.z)
        const distance = tempPoint.distanceTo(tempVertex)

        if (distance < minDistance) {
          minDistance = distance
          closestVertex = vertex.clone()
        }
      })

      // y=20 높이로 투영된 점 반환
      return new THREE.Vector3(closestVertex.x, 20, closestVertex.z)
    })
  }

  // 투영된 점들을 원래의 y 좌표로 복원하는 함수
  function restoreOriginalHeight(
    elevatedPoints: THREE.Vector3[],
    originalPoints: THREE.Vector3[]
  ): THREE.Vector3[] {
    return elevatedPoints.map((elevatedPoint, index) => {
      return new THREE.Vector3(elevatedPoint.x, originalPoints[index].y, elevatedPoint.z)
    })
  }

  // 기존 processPointCloudProjection 함수 수정
  function processPointCloudProjection(
    points: THREE.Vector3[],
    triangleMesh: THREE.Mesh
  ): {
    projectedPoints: THREE.Vector3[]
    elevatedPoints: THREE.Vector3[]
  } {
    const elevatedPoints = projectPointsToElevatedMesh(points, triangleMesh)
    const projectedPoints = restoreOriginalHeight(elevatedPoints, points)

    return { projectedPoints, elevatedPoints }
  }

  // 포인트 클라우드 시각화를 위한 유틸리티 함수
  function visualizePointCloud(
    points: THREE.Vector3[],
    color: number,
    sphereSize: number = 0.1
  ): THREE.Group {
    const group = new THREE.Group()
    const sphereGeometry = new THREE.SphereGeometry(sphereSize, 8, 8)
    const sphereMaterial = new THREE.MeshPhongMaterial({ color: color })

    points.forEach((point) => {
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
      sphere.position.copy(point)
      group.add(sphere)
    })

    return group
  }

  // visualizeGeometry 함수 수정
  function visualizeGeometry(
    geometry: THREE.BufferGeometry | THREE.Vector3[],
    fileType: 'stl' | 'ply'
  ) {
    if (meshes[fileType]) {
      currentScene?.remove(meshes[fileType]!)
    }

    const group = new THREE.Group()

    if (fileType === 'stl') {
      visualizeSTLGeometry(geometry as THREE.BufferGeometry, group)
    } else {
      visualizePLYGeometry(geometry as THREE.Vector3[], group)
    }

    meshes[fileType] = group
    currentScene?.add(group)
  }

  // STL 시각화를 위한 함수
  function visualizeSTLGeometry(geometry: THREE.BufferGeometry, group: THREE.Group) {
    // 기본 STL 메쉬 생성
    const material = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      specular: 0x111111,
      shininess: 200,
      transparent: true,
      opacity: 1
    })
    const mesh = new THREE.Mesh(geometry, material)
    group.add(mesh)

    // 표면 좌표 추출 및 추가 처리
    const surfacePoints = extractSurfacePoints(geometry)
    const convexHullGroup = createSplineBasedConvexHull(surfacePoints)
    const triangleMesh = createSplineBasedTriangleMesh(surfacePoints)

    group.add(convexHullGroup)
    group.add(triangleMesh)
  }

  // 가장 가까운 외부 오프셋 포인트를 찾는 함수
  function findClosestOffsetPoint(
    point: THREE.Vector3,
    offsetPoints: THREE.Vector3[]
  ): THREE.Vector3 {
    let minDistance = Infinity
    let closestPoint = offsetPoints[0]

    offsetPoints.forEach((offsetPoint) => {
      const distance = point.distanceTo(offsetPoint)
      if (distance < minDistance) {
        minDistance = distance
        closestPoint = offsetPoint
      }
    })

    return closestPoint
  }

  // PLY 시각화를 위한 함수 수정
  function visualizePLYGeometry(points: THREE.Vector3[], group: THREE.Group) {
    if (meshes['stl']) {
      const triangleMesh = findTriangleMesh(meshes['stl'])
      if (triangleMesh) {
        const elevatedPoints = projectPointsToElevatedMesh(points, triangleMesh)
        const projectedPoints = restoreOriginalHeight(elevatedPoints, points)
        // group.add(visualizePointCloud(projectedPoints, 0xff0000))
        // group.add(visualizePointCloud(elevatedPoints, 0x0000ff))

        const closestPoints = elevatedPoints.map((point) =>
          findClosestOffsetPoint(point, calculatedPoints.offsetPointsLowerOuter)
        )

        // triangleMesh의 vertex 좌표들을 Vector3 배열로 변환
        const vertices = triangleMesh.geometry.getAttribute('position')
        const meshVertices: THREE.Vector3[] = []
        for (let i = 0; i < vertices.count; i++) {
          meshVertices.push(new THREE.Vector3(vertices.getX(i), vertices.getY(i), vertices.getZ(i)))
        }

        // group.add(visualizePointCloud(closestPoints, 0x00ff00))
        const D = 2
        const alpha = 3
        if (currentScene) {
          calculateGingivalProfile(
            D,
            projectedPoints,
            elevatedPoints,
            closestPoints,
            meshVertices, // 변환된 vertex 배열 전달
            alpha,
            currentScene
          )
        }
      }
    }
  }

  // 삼각형 메쉬를 찾는 헬퍼 함수
  function findTriangleMesh(meshGroup: THREE.Mesh | THREE.Group | null): THREE.Mesh | null {
    let triangleMesh: THREE.Mesh | null = null

    if (meshGroup) {
      meshGroup.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          child.material instanceof THREE.MeshPhongMaterial &&
          child.material.opacity === 1
        ) {
          triangleMesh = child
        }
      })
    }

    return triangleMesh
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

  // 삼각형 메쉬 생성을 위한 함수
  function createTriangleMeshFromPoints(
    lowerPoints: THREE.Vector3[],
    innerPoints: THREE.Vector3[]
  ): THREE.Mesh {
    const allPointsForMesh = [...lowerPoints, ...innerPoints]
    const triangleMesh = MeshGenerator.createTriangleMesh(allPointsForMesh, 0xff9999, 1)

    // 버텍스 시각화 (흰색)
    // currentScene?.add(visualizePointCloud(allPointsForMesh, 0xffffff, 0.05))

    return triangleMesh
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
