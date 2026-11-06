import type { Bounds, MeshData } from './types'

/**
 * 计算包围盒 + 包围球。
 * 包围球取「顶点到中心的最大距离」而不是包围盒对角线,更贴合细长模型。
 */
export function computeBounds(mesh: Pick<MeshData, 'positions'>): Bounds {
  const { positions } = mesh
  if (positions.length < 3) {
    throw new Error('mesh: positions 为空,无法计算包围盒')
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]
    const y = positions[i + 1]
    const z = positions[i + 2]
    if (x < minX)
      minX = x
    if (y < minY)
      minY = y
    if (z < minZ)
      minZ = z
    if (x > maxX)
      maxX = x
    if (y > maxY)
      maxY = y
    if (z > maxZ)
      maxZ = z
  }

  const center: [number, number, number] = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  ]

  let maxDistanceSq = 0
  for (let i = 0; i < positions.length; i += 3) {
    const dx = positions[i] - center[0]
    const dy = positions[i + 1] - center[1]
    const dz = positions[i + 2] - center[2]
    const distanceSq = dx * dx + dy * dy + dz * dz
    if (distanceSq > maxDistanceSq)
      maxDistanceSq = distanceSq
  }

  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    center,
    radius: Math.sqrt(maxDistanceSq),
  }
}
