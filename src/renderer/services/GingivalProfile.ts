import * as THREE from 'three'
import { Vector3 } from 'three'
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js'

// 두 점 사이의 선분 상에서 점들을 찾는 함수
function findPointsOnLine(
  startPoint: Vector3, // 시작점 (잇몸 포인트)
  endPoint: Vector3, // 끝점 (스플라인 포인트)
  vertexPoints: THREE.Vector3[], // 검사할 버텍스 포인트들의 배열
  scene: THREE.Scene, // Three.js 씬 객체
  D: number // 최대 거리 제한
): Vector3[] {
  // 결과를 저장할 배열들 초기화
  const projectedPoints: Vector3[] = [] // 투영된 포인트들을 저장
  const allPoints: Vector3[] = [] // 모든 선택된 포인트들을 저장
  const RADIUS = 0.5 // 포인트 검색 반경
  const ANGLE_THRESHOLD = 0.1 // 허용 각도 임계값

  // 시작점에서 끝점으로 향하는 방향 벡터 계산
  const lineDirection = new Vector3().subVectors(endPoint, startPoint).normalize()

  // 시작점으로 초기화하고 배열에 추가
  let currentPoint = startPoint.clone()
  allPoints.push(currentPoint.clone())
  projectedPoints.push(currentPoint.clone())

  // 현재 점이 시작점으로부터 D 거리 이내인 동안 반복
  while (currentPoint.distanceTo(startPoint) <= D) {
    let bestNextPoint: Vector3 | null = null
    let minAngleDiff = Infinity

    // 모든 버텍스 포인트에 대해 검사
    for (const vertex of vertexPoints) {
      const dist = currentPoint.distanceTo(vertex) // 현재 점과 버텍스 사이의 거리
      const distFromStart = vertex.distanceTo(startPoint) // 시작점에서 버텍스까지의 거리

      // 거리 조건 확인: RADIUS 이내이고 D 거리 제한 내에 있는지
      if (dist > 0 && dist <= RADIUS && distFromStart <= D) {
        // 현재 점에서 버텍스로 향하는 방향 벡터와 기준 방향 벡터 사이의 각도 계산
        const directionToVertex = new Vector3().subVectors(vertex, currentPoint).normalize()
        const angleDiff = directionToVertex.angleTo(lineDirection)

        // 각도가 임계값보다 작고 지금까지 찾은 최소 각도보다 작으면 업데이트
        if (angleDiff < ANGLE_THRESHOLD && angleDiff < minAngleDiff) {
          minAngleDiff = angleDiff
          bestNextPoint = vertex
        }
      }
    }

    // 적합한 다음 포인트를 찾지 못했으면 종료
    if (!bestNextPoint) break

    // 다음 포인트로 이동하고 배열에 추가
    currentPoint = bestNextPoint
    allPoints.push(currentPoint.clone())

    if (currentPoint.distanceTo(startPoint) <= D) {
      projectedPoints.push(currentPoint.clone())
    }
  }

  // // 찾은 포인트들을 오렌지색 구체로 시각화
  // allPoints.forEach((point) => {
  //   const sphereGeometry = new THREE.SphereGeometry(0.2, 32, 32)
  //   const orangeSphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffa500 })
  //   const orangeSphere = new THREE.Mesh(sphereGeometry, orangeSphereMaterial)
  //   orangeSphere.position.copy(point)
  //   scene.add(orangeSphere)
  // })

  // D 거리 이내의 포인트들만 필터링하여 반환
  return allPoints.filter((point) => point.distanceTo(startPoint) <= D)
}

function extractVertexPointsOnLine(
  gingivalPoint: Vector3,
  splinePoint: Vector3,
  vertexPoints: THREE.Vector3[],
  scene: THREE.Scene,
  D: number
): Vector3[] {
  const points = findPointsOnLine(gingivalPoint, splinePoint, vertexPoints, scene, D)
  return points
}

// 변형된 점을 시각화하는 함수 추가
function visualizePoint(position: Vector3, scene: THREE.Scene): void {
  const sphereGeometry = new THREE.SphereGeometry(0.05, 32, 32)
  const purpleMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff })
  const purpleSphere = new THREE.Mesh(sphereGeometry, purpleMaterial)
  purpleSphere.position.copy(position)
  scene.add(purpleSphere)
}

// 변형된 Y 좌표를 계산하는 함수
function calculateDeformedY(
  point: Vector3,
  gingivalPoint: Vector3,
  directionVector: Vector3,
  D: number,
  height: number,
  alpha: number,
  offset: number
): number {
  const t = point.distanceTo(gingivalPoint) / D
  const scaledDirection = directionVector.clone().multiplyScalar(t)
  const R = scaledDirection.length()
  const R2alpha = Math.pow(R, 2 * alpha)
  const D2 = 1
  const R2alphaMinusD2 = R2alpha - D2
  return height * Math.pow(R2alphaMinusD2, 2) + offset
}

function deformAndVisualizePoints(
  gingivalPoint: Vector3,
  splinePoint: Vector3,
  gingivalPointY: number,
  pointsTobeDeformed: Vector3[],
  D: number,
  alpha: number,
  offset: number,
  scene: THREE.Scene
): Vector3[] {
  const b = splinePoint.clone()
  const p = gingivalPoint.clone()
  const height = -1 * Math.abs(offset - 1 * gingivalPointY)
  const directionVector = new Vector3().subVectors(b, p).normalize()

  // 변형된 포인트들을 저장할 배열
  const deformedPoints: Vector3[] = []

  pointsTobeDeformed.forEach((point) => {
    const deformedPoint = point.clone()
    deformedPoint.y = calculateDeformedY(
      point,
      gingivalPoint,
      directionVector,
      D,
      height,
      alpha,
      offset
    )
    deformedPoints.push(deformedPoint)
    // visualizePoint(deformedPoint, scene)
  })

  return deformedPoints
}

function interpolatePoints(points: Vector3[], subdivisions: number): Vector3[] {
  if (points.length < 2) return points

  const interpolatedPoints: Vector3[] = []

  // 포인트들을 x 좌표 기준으로 정렬
  const sortedPoints = [...points].sort((a, b) => a.x - b.x)

  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const start = sortedPoints[i]
    const end = sortedPoints[i + 1]

    interpolatedPoints.push(start.clone())

    // 두 점 사이에 보간된 점들 추가
    for (let j = 1; j < subdivisions; j++) {
      const t = j / subdivisions
      const interpolated = new Vector3(
        start.x + (end.x - start.x) * t,
        start.y + (end.y - start.y) * t,
        start.z + (end.z - start.z) * t
      )
      interpolatedPoints.push(interpolated)
    }
  }

  // 마지막 점 추가
  interpolatedPoints.push(sortedPoints[sortedPoints.length - 1].clone())

  return interpolatedPoints
}

export function calculateGingivalProfile(
  D: number,
  gingivalPointsY: Vector3[],
  gingivalPoints: Vector3[],
  splinePoints: Vector3[],
  vertexPoints: THREE.Vector3[],
  alpha: number,
  scene: THREE.Scene
): void {
  const offset = 20
  const allDeformedPoints: Vector3[] = []

  // 각 gingival point에 대한 변형된 포인트들 수집
  for (let i = 0; i < gingivalPoints.length; i++) {
    const pointsTobeDeformed = extractVertexPointsOnLine(
      gingivalPoints[i],
      splinePoints[i],
      vertexPoints,
      scene,
      D
    )

    const deformedPoints = deformAndVisualizePoints(
      gingivalPoints[i],
      splinePoints[i],
      gingivalPointsY[i].y,
      pointsTobeDeformed,
      D,
      alpha,
      offset,
      scene
    )

    allDeformedPoints.push(...deformedPoints)
  }

  // 보간된 포인트 생성 (subdivisions 값으로 보간 밀도 조절)
  const interpolatedPoints = interpolatePoints(allDeformedPoints, 5)

  // Convex Hull 메쉬 생성
  if (interpolatedPoints.length >= 4) {
    const convexGeometry = new ConvexGeometry(interpolatedPoints)
    const material = new THREE.MeshPhongMaterial({
      color: 0xff9999,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide
    })
    const convexMesh = new THREE.Mesh(convexGeometry, material)
    scene.add(convexMesh)
  }
}
