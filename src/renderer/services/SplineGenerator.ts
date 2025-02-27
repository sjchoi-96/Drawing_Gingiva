import * as THREE from 'three'

export class SplineGenerator {
  // 스플라인 곡선 생성
  static createSplineCurve(points: THREE.Vector3[], yOffset: number = 0): THREE.CatmullRomCurve3 {
    const offsetPoints = points.map(
      (point) => new THREE.Vector3(point.x, point.y + yOffset, point.z)
    )
    return new THREE.CatmullRomCurve3(offsetPoints, false, 'catmullrom', 0.5)
  }

  // 스플라인 곡선의 오프셋 곡선 생성
  static createOffsetSplineCurve(curve: THREE.CatmullRomCurve3, offset: number): THREE.Vector3[] {
    const points = curve.getPoints(500)
    const offsetPoints: THREE.Vector3[] = []

    for (let i = 0; i < points.length; i++) {
      const currentPoint = points[i]
      const nextPoint = points[i + 1] || points[i]
      const prevPoint = points[i - 1] || points[i]

      const tangent = new THREE.Vector3().subVectors(nextPoint, prevPoint).normalize()
      const normal = new THREE.Vector3(-tangent.z, tangent.y, tangent.x)
      const offsetPoint = currentPoint.clone().add(normal.multiplyScalar(offset))

      offsetPoints.push(offsetPoint)
    }

    return offsetPoints
  }

  // 스플라인과 포인트 시각화
  static visualizeSplineAndPoints(
    points: THREE.Vector3[],
    curve: THREE.CatmullRomCurve3
  ): THREE.Group {
    const group = new THREE.Group()
    const curveGeometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(100))
    const curveMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 })
    const splineLine = new THREE.Line(curveGeometry, curveMaterial)
    group.add(splineLine)
    return group
  }
}
