import { describe, expect, it } from 'vitest'
import { computeBounds } from './bounds'
import { countTriangles, createPerfMesh, createSphereMesh } from './generate'

describe('createSphereMesh', () => {
  it('三角形数量符合 2 * segments * (bands - 1)', () => {
    const mesh = createSphereMesh(5, 8)
    expect(countTriangles(mesh)).toBe(2 * 8 * 4)
    expect(mesh.indices.length).toBe(countTriangles(mesh) * 3)
  })

  it('索引全部落在顶点范围内', () => {
    const mesh = createSphereMesh(6, 10)
    const vertexCount = mesh.positions.length / 3
    expect(vertexCount).toBe(2 + 5 * 10)

    for (let i = 0; i < mesh.indices.length; i++) {
      expect(mesh.indices[i]).toBeLessThan(vertexCount)
    }
  })

  it('所有面朝外(法线与面重心同向)', () => {
    const mesh = createSphereMesh(4, 6)
    const { positions, indices } = mesh

    for (let i = 0; i < indices.length; i += 3) {
      const ia = indices[i] * 3
      const ib = indices[i + 1] * 3
      const ic = indices[i + 2] * 3

      const ax = positions[ia]
      const ay = positions[ia + 1]
      const az = positions[ia + 2]
      const bx = positions[ib]
      const by = positions[ib + 1]
      const bz = positions[ib + 2]
      const cx = positions[ic]
      const cy = positions[ic + 1]
      const cz = positions[ic + 2]

      // 面法线 = (b - a) × (c - a)
      const abx = bx - ax
      const aby = by - ay
      const abz = bz - az
      const acx = cx - ax
      const acy = cy - ay
      const acz = cz - az

      const nx = aby * acz - abz * acy
      const ny = abz * acx - abx * acz
      const nz = abx * acy - aby * acx

      // 重心方向即单位球上的外法线方向
      const gx = (ax + bx + cx) / 3
      const gy = (ay + by + cy) / 3
      const gz = (az + bz + cz) / 3

      expect(nx * gx + ny * gy + nz * gz).toBeGreaterThan(0)
    }
  })
})

describe('computeBounds', () => {
  it('单位球的中心在原点、半径为 1', () => {
    const bounds = computeBounds(createSphereMesh(8, 12))
    expect(bounds.center[0]).toBeCloseTo(0, 5)
    expect(bounds.center[1]).toBeCloseTo(0, 5)
    expect(bounds.center[2]).toBeCloseTo(0, 5)
    expect(bounds.radius).toBeCloseTo(1, 5)
  })

  it('空网格抛错', () => {
    expect(() => computeBounds({ positions: new Float32Array(0) })).toThrow()
  })
})

describe('createPerfMesh', () => {
  it('面数贴近目标值', () => {
    const mesh = createPerfMesh(20_000)
    const triangles = countTriangles(mesh)
    expect(triangles).toBeGreaterThan(18_000)
    expect(triangles).toBeLessThan(22_000)
  })
})
