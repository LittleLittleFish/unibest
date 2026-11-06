/**
 * 与平台、渲染库无关的网格数据。
 * 只放 TypedArray,不引入 three.js,便于后续搬进 worker / wasm / 独立包。
 */
export interface MeshData {
  /** xyz 连续排列,长度 = 顶点数 * 3 */
  positions: Float32Array
  /** 三角形索引,长度 = 面数 * 3 */
  indices: Uint32Array
  /** 可选顶点法线,长度与 positions 一致;缺省时渲染层自行计算 */
  normals?: Float32Array
}

export interface Bounds {
  min: [number, number, number]
  max: [number, number, number]
  center: [number, number, number]
  /** 包围球半径(所有顶点到 center 的最大距离) */
  radius: number
}
