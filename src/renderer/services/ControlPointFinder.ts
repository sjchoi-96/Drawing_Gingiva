import * as THREE from 'three'

export class ControlPointFinder {
  // 최대 거리 점을 찾는 함수
  static findMaxDistancePoint(
    topPoint: THREE.Vector3,
    sidePoint: THREE.Vector3,
    sampledPoints: THREE.Vector3[]
  ): THREE.Vector3 {
    const direction = new THREE.Vector3().subVectors(topPoint, sidePoint).normalize()
    let maxDistance = 0
    let maxDistPoint = sampledPoints[0]

    // sidePoint의 x 좌표에 따라 필터링 방향 결정
    sampledPoints
      .filter((point) => (sidePoint.x < 0 ? point.x < 0 : point.x > 0))
      .forEach((point) => {
        // 점과 직선 사이의 거리 계산
        const v = new THREE.Vector3().subVectors(point, sidePoint)
        const projLength = v.dot(direction)
        const proj = new THREE.Vector3().addVectors(
          sidePoint,
          direction.clone().multiplyScalar(projLength)
        )
        const distance = point.distanceTo(proj)

        if (distance > maxDistance) {
          maxDistance = distance
          maxDistPoint = point
        }
      })

    return maxDistPoint
  }

  // 5개의 특별한 점을 찾는 함수
  static findFiveControlPoints(sampledPoints: THREE.Vector3[]): THREE.Vector3[] {
    // x값이 최소/최대인 점을 찾되, z값은 전체 점들 중 최소 z값으로 설정(최하단 점을 기준으로 z값 변경, 생성되는 스플라인곡선이 잇몸 점체를 뒤덮기 위함함)
    const minZ = sampledPoints.reduce((min, p) => (p.z < min.z ? p : min)).z
    const minX = new THREE.Vector3(
      sampledPoints.reduce((min, p) => (p.x < min.x ? p : min)).x,
      sampledPoints.reduce((min, p) => (p.x < min.x ? p : min)).y,
      minZ
    )
    const maxX = new THREE.Vector3(
      sampledPoints.reduce((max, p) => (p.x > max.x ? p : max)).x,
      sampledPoints.reduce((max, p) => (p.x > max.x ? p : max)).y,
      minZ
    )

    // Z값 기준으로 정렬하여 상위 10개 점 선택 후 평균 계산
    const topZPoints = [...sampledPoints].sort((a, b) => b.z - a.z).slice(0, 10)
    const avgTopZ = new THREE.Vector3()
    topZPoints.forEach((p) => avgTopZ.add(p))
    avgTopZ.divideScalar(10)

    // 최대 거리 점 찾기
    const maxDistPoint_minusx = this.findMaxDistancePoint(avgTopZ, minX, sampledPoints)
    const maxDistPoint_plusx = this.findMaxDistancePoint(avgTopZ, maxX, sampledPoints)

    // 5개의 제어점을 순서대로 반환
    return [minX, maxDistPoint_minusx, avgTopZ, maxDistPoint_plusx, maxX]
  }

  // 특별한 점들의 그룹 생성
  static createSpecialPointsGroup(points: THREE.Vector3[]): THREE.Vector3[] {
    if (points.length !== 5) {
      throw new Error('5개의 제어점이 필요합니다.')
    }
    return points
  }
}
