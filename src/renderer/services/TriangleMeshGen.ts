import * as THREE from 'three'

// MeshGenerator 클래스 추가
export class MeshGenerator {
  static createTriangleMesh(points: THREE.Vector3[], color: number, opacity: number): THREE.Mesh {
    // 2D 좌표로 변환
    const points2D = points.map((p, index) => ({
      x: p.x,
      y: p.z,
      index: index
    }))

    // Delaunay 삼각분할을 위한 배열 준비
    const vertices: number[] = []
    const indices: number[] = []

    // 포인트들을 vertices 배열에 추가
    points.forEach((point) => {
      vertices.push(point.x, point.y, point.z)
    })

    // Delaunay 삼각분할 수행
    const triangles = this.delaunayTriangulation(points2D)
    triangles.forEach((triangle) => {
      indices.push(triangle.a, triangle.b, triangle.c)
    })

    return this.createMeshFromGeometry(vertices, indices, color, opacity)
  }

  static generateInnerPoints(
    innerSplinePoints: THREE.Vector3[],
    outerSplinePoints: THREE.Vector3[]
  ): THREE.Vector3[] {
    const innerPoints: THREE.Vector3[] = []
    const POINTS_PER_LINE = 30 // 각 선분당 생성할 포인트 수

    // 각 내부 스플라인 포인트에 대해
    for (const innerPoint of innerSplinePoints) {
      // 가장 가까운 외부 스플라인 포인트 찾기
      let nearestOuterPoint = outerSplinePoints[0]
      let minDistance = innerPoint.distanceTo(outerSplinePoints[0])

      for (const outerPoint of outerSplinePoints) {
        const distance = innerPoint.distanceTo(outerPoint)
        if (distance < minDistance) {
          minDistance = distance
          nearestOuterPoint = outerPoint
        }
      }

      // 내부점과 외부점 사이의 선분 위에 포인트 생성
      const direction = new THREE.Vector3().subVectors(nearestOuterPoint, innerPoint)
      const totalDistance = direction.length()
      direction.normalize()

      // 균등한 간격으로 포인트 생성
      for (let i = 1; i < POINTS_PER_LINE; i++) {
        const ratio = i / POINTS_PER_LINE
        const newPoint = new THREE.Vector3()
          .copy(innerPoint)
          .add(direction.clone().multiplyScalar(totalDistance * ratio))

        // y 좌표는 20으로 고정
        newPoint.y = 20
        innerPoints.push(newPoint)
      }
    }

    return innerPoints
  }

  private static createMeshFromGeometry(
    vertices: number[],
    indices: number[],
    color: number,
    opacity: number
  ): THREE.Mesh {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    const meshMaterial = new THREE.MeshPhongMaterial({
      color: color,
      opacity: opacity,
      transparent: true,
      side: THREE.DoubleSide,
      flatShading: true
    })

    const mesh = new THREE.Mesh(geometry, meshMaterial)

    return mesh
  }

  // Delaunay 삼각분할을 위한 새로운 메서드
  private static delaunayTriangulation(
    points: { x: number; y: number; index: number }[]
  ): { a: number; b: number; c: number }[] {
    // 슈퍼 삼각형 생성 (모든 점을 포함하는 큰 삼각형)
    const minX = Math.min(...points.map((p) => p.x))
    const maxX = Math.max(...points.map((p) => p.x))
    const minY = Math.min(...points.map((p) => p.y))
    const maxY = Math.max(...points.map((p) => p.y))

    const dx = maxX - minX
    const dy = maxY - minY
    const dmax = Math.max(dx, dy)
    const midX = (minX + maxX) / 2
    const midY = (minY + maxY) / 2

    const superTriangle = {
      a: { x: midX - 20 * dmax, y: midY - dmax, index: -1 },
      b: { x: midX, y: midY + 20 * dmax, index: -2 },
      c: { x: midX + 20 * dmax, y: midY - dmax, index: -3 }
    }

    let triangulation = [superTriangle]

    // 각 점을 순차적으로 추가
    for (const point of points) {
      const edges: Set<string> = new Set()

      // 점이 포함된 삼각형 찾기 및 제거
      triangulation = triangulation.filter((triangle) => {
        if (this.isPointInCircumcircle(point, triangle)) {
          // 삼각형의 엣지 저장
          this.addEdge(edges, triangle.a.index, triangle.b.index)
          this.addEdge(edges, triangle.b.index, triangle.c.index)
          this.addEdge(edges, triangle.c.index, triangle.a.index)
          return false
        }
        return true
      })

      // 새로운 삼각형 생성
      for (const edge of edges) {
        const [a, b] = edge.split(',').map(Number)
        const vertexA =
          points.find((p) => p.index === a) ||
          [superTriangle.a, superTriangle.b, superTriangle.c].find((p) => p.index === a)!
        const vertexB =
          points.find((p) => p.index === b) ||
          [superTriangle.a, superTriangle.b, superTriangle.c].find((p) => p.index === b)!

        triangulation.push({
          a: vertexA,
          b: vertexB,
          c: point
        })
      }
    }

    // 슈퍼 삼각형 제거
    triangulation = triangulation.filter(
      (triangle) => triangle.a.index >= 0 && triangle.b.index >= 0 && triangle.c.index >= 0
    )

    // 최종 삼각형 인덱스 반환
    return triangulation.map((t) => ({
      a: t.a.index,
      b: t.b.index,
      c: t.c.index
    }))
  }

  private static isPointInCircumcircle(
    point: { x: number; y: number },
    triangle: {
      a: { x: number; y: number }
      b: { x: number; y: number }
      c: { x: number; y: number }
    }
  ): boolean {
    const ax = triangle.a.x
    const ay = triangle.a.y
    const bx = triangle.b.x
    const by = triangle.b.y
    const cx = triangle.c.x
    const cy = triangle.c.y

    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if (Math.abs(d) < 1e-10) return false

    const ux =
      ((ax * ax + ay * ay) * (by - cy) +
        (bx * bx + by * by) * (cy - ay) +
        (cx * cx + cy * cy) * (ay - by)) /
      d
    const uy =
      ((ax * ax + ay * ay) * (cx - bx) +
        (bx * bx + by * by) * (ax - cx) +
        (cx * cx + cy * cy) * (bx - ax)) /
      d

    const radius = Math.sqrt((ax - ux) * (ax - ux) + (ay - uy) * (ay - uy))
    const dist = Math.sqrt((point.x - ux) * (point.x - ux) + (point.y - uy) * (point.y - uy))

    return dist <= radius
  }

  private static addEdge(edges: Set<string>, a: number, b: number) {
    const [min, max] = [Math.min(a, b), Math.max(a, b)]
    const key = `${min},${max}`
    if (edges.has(key)) {
      edges.delete(key)
    } else {
      edges.add(key)
    }
  }
}
