// 입력 : D(숫자), 잇몸포인트 포인트 클라우드 y값(배열)(ply의 빨간색 포인트), 잇몸포인트 포인트 클라우드의  xz평면상의 좌표(배열)(ply의 초록색색 포인트), 외부 스플라인 곡선의 xz평면상의 좌표(배열)
// 출력 : 잇몸포인트 포인트 클라우드의 xz평면상의 배열을 함수 프로파일에 적용하여 y값을 변환하고 변환된 y값을 이용해서 잇몸포인트 클라우드의 좌표를 갱신하여 출력(배열)

// 함수 프로파일 : -1*절댓값(잇몸포인트 포인트 클라우드 y값)* (R^(2*alpha)-D^2)^2
// 함수 프로파일의 변수 : R, alpha, D
// 조건 D, alpha 는 양수

// R= D* 절댓값( P벡터 + t*((b벡터-p벡터)/절댓값(b벡터-p벡터)) )
// P벡터 : 잇몸포인트 포인트 클라우드의   xz평면상의 좌표(배열)
// b벡터 : 외부 스플라인 곡선의 xz평면상의 좌표(배열)

// t = (V벡터-P벡터)/D

// V벡터 : 평면상의 버텍스 (노란색 포인트트)

import * as THREE from 'three'
import { Vector3 } from 'three'

// 두 점 사이의 선분 상에서 점들을 찾는 함수
function findPointsOnLine(
  startPoint: Vector3,
  endPoint: Vector3,
  vertexPoints: THREE.Vector3[],
  scene: THREE.Scene
): Vector3[] {
  const projectedPoints: Vector3[] = []
  const RADIUS = 0.5 // 검색 반경
  const ANGLE_THRESHOLD = 0.1 // 방향 벡터 일치 허용 오차

  // 시작점 추가 및 시각화
  const sphereGeometry = new THREE.SphereGeometry(0.2, 32, 32)
  const orangeSphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffa500 })
  const startSphere = new THREE.Mesh(sphereGeometry, orangeSphereMaterial)
  startSphere.position.copy(startPoint)
  scene.add(startSphere)
  projectedPoints.push(startPoint.clone())

  // 선분의 방향 벡터
  const lineDirection = new Vector3().subVectors(endPoint, startPoint).normalize()

  // 현재 검색 시작점
  let currentPoint = startPoint.clone()
  projectedPoints.push(currentPoint.clone())

  while (currentPoint.distanceTo(endPoint) > RADIUS) {
    let bestNextPoint: Vector3 | null = null
    let minAngleDiff = Infinity

    // 현재 점 주변의 모든 점들을 검사
    for (const vertex of vertexPoints) {
      const dist = currentPoint.distanceTo(vertex)

      if (dist > 0 && dist <= RADIUS) {
        const directionToVertex = new Vector3().subVectors(vertex, currentPoint).normalize()
        const angleDiff = directionToVertex.angleTo(lineDirection)

        if (angleDiff < ANGLE_THRESHOLD && angleDiff < minAngleDiff) {
          minAngleDiff = angleDiff
          bestNextPoint = vertex
        }
      }
    }

    if (!bestNextPoint) break

    currentPoint = bestNextPoint
    projectedPoints.push(currentPoint.clone())

    // 시각화
    const sphereGeometry = new THREE.SphereGeometry(0.2, 32, 32)
    const orangeSphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffa500 })
    const orangeSphere = new THREE.Mesh(sphereGeometry, orangeSphereMaterial)
    orangeSphere.position.copy(currentPoint)
    scene.add(orangeSphere)
  }

  if (currentPoint.distanceTo(endPoint) <= RADIUS) {
    projectedPoints.push(endPoint.clone())
  }

  // 끝점 추가 및 시각화
  const endSphere = new THREE.Mesh(sphereGeometry, orangeSphereMaterial)
  endSphere.position.copy(endPoint)
  scene.add(endSphere)
  projectedPoints.push(endPoint.clone())

  return projectedPoints
}

function extractVertexPointsOnLine(
  gingivalPoint: Vector3,
  splinePoint: Vector3,
  vertexPoints: THREE.Vector3[],
  scene: THREE.Scene
): Vector3[] {
  const points = findPointsOnLine(gingivalPoint, splinePoint, vertexPoints, scene)
  return points
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
  // gingivalPoints 배열을 순회
  for (let i = 0; i < gingivalPoints.length; i++) {
    const pointsTobeDeformed = extractVertexPointsOnLine(
      gingivalPoints[i],
      splinePoints[i],
      vertexPoints,
      scene
    )

    // 변형 함수 프로파일
  }
}

// 가장 가까운 스플라인 포인트를 찾는 헬퍼 함수
function findNearestSplinePoint(P: Vector3, splinePoints: Vector3[]): Vector3 {
  let minDist = Infinity
  let nearestPoint = splinePoints[0]

  for (const splinePoint of splinePoints) {
    const dist = P.distanceTo(splinePoint)
    if (dist < minDist) {
      minDist = dist
      nearestPoint = splinePoint
    }
  }

  return nearestPoint
}
