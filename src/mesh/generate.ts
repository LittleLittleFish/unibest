import type { MeshData } from './types'

/** 三角形数量 */
export function countTriangles(mesh: Pick<MeshData, 'indices'>): number {
  return Math.floor(mesh.indices.length / 3)
}

/**
 * 生成单位经纬球(球心在原点,半径 1)。
 * 北极点、南极点各一个顶点,中间 `bands - 1` 圈纬线,每圈 `segments` 个顶点;
 * 三角形数 = 2 * segments * (bands - 1)。
 *
 * 法线直接取归一化后的顶点位置(单位球上法线 == 位置),省掉一次遍历。
 */
export function createSphereMesh(bands: number, segments: number): MeshData {
  const ringCount = Math.max(1, Math.floor(bands) - 1)
  const segCount = Math.max(3, Math.floor(segments))
  const vertexCount = 2 + ringCount * segCount
  const triangleCount = 2 * segCount * ringCount

  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)

  // 顶点 0 = 北极点,顶点 1 = 南极点
  positions[1] = 1
  normals[1] = 1
  positions[4] = -1
  normals[4] = -1

  for (let row = 0; row < ringCount; row++) {
    const phi = (Math.PI * (row + 1)) / (ringCount + 1)
    const ringRadius = Math.sin(phi)
    const y = Math.cos(phi)

    for (let s = 0; s < segCount; s++) {
      const theta = (2 * Math.PI * s) / segCount
      const x = ringRadius * Math.cos(theta)
      const z = ringRadius * Math.sin(theta)

      const offset = (2 + row * segCount + s) * 3
      positions[offset] = x
      positions[offset + 1] = y
      positions[offset + 2] = z
      normals[offset] = x
      normals[offset + 1] = y
      normals[offset + 2] = z
    }
  }

  const indices = new Uint32Array(triangleCount * 3)
  let cursor = 0

  // 顶部:扇形三角形,逆时针朝外
  for (let s = 0; s < segCount; s++) {
    const current = 2 + s
    const next = 2 + ((s + 1) % segCount)
    indices[cursor++] = 0
    indices[cursor++] = next
    indices[cursor++] = current
  }

  // 中间:每两个相邻纬线环之间是两个三角形
  for (let row = 0; row < ringCount - 1; row++) {
    const upper = 2 + row * segCount
    const lower = 2 + (row + 1) * segCount

    for (let s = 0; s < segCount; s++) {
      const nextSeg = (s + 1) % segCount
      const a = upper + s
      const b = upper + nextSeg
      const c = lower + s
      const d = lower + nextSeg

      indices[cursor++] = a
      indices[cursor++] = b
      indices[cursor++] = d

      indices[cursor++] = a
      indices[cursor++] = d
      indices[cursor++] = c
    }
  }

  // 底部:扇形三角形,逆时针朝外
  const bottomRing = 2 + (ringCount - 1) * segCount
  for (let s = 0; s < segCount; s++) {
    const current = bottomRing + s
    const next = bottomRing + ((s + 1) % segCount)
    indices[cursor++] = current
    indices[cursor++] = next
    indices[cursor++] = 1
  }

  return { positions, indices, normals }
}

/**
 * 按目标面数生成球面网格,用于 W0 性能验证(如 1 万 / 5 万 / 20 万面)。
 * 实际面数会贴近但不等于目标值,返回值里用 countTriangles() 取准确值。
 */
export function createPerfMesh(targetTriangles: number): MeshData {
  const target = Math.max(8, Math.floor(targetTriangles))
  const segments = Math.max(3, Math.round(Math.sqrt(target / 2)))
  const bands = Math.max(2, Math.round(target / (2 * segments)) + 1)

  return createSphereMesh(bands, segments)
}
