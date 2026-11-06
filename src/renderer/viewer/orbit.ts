/**
 * 轨道相机:球坐标 + 目标点,不依赖 three,可单测。
 * 旋转/缩放的数学都在这里,手势层只负责把指针位移喂进来。
 */
export interface OrbitCameraOptions {
  /** 初始方位角(绕 Y 轴,弧度) */
  azimuth?: number
  /** 初始极角(从 +Y 轴算起,弧度) */
  polar?: number
  minDistance?: number
  maxDistance?: number
}

const MIN_POLAR = 0.08
const MAX_POLAR = Math.PI - 0.08

export class OrbitCamera {
  azimuth: number
  polar: number

  private distance = 3
  private target: [number, number, number] = [0, 0, 0]
  private minDistance: number
  private maxDistance: number

  constructor(options: OrbitCameraOptions = {}) {
    this.azimuth = options.azimuth ?? Math.PI / 5
    this.polar = clamp(options.polar ?? Math.PI / 3, MIN_POLAR, MAX_POLAR)
    this.minDistance = options.minDistance ?? 0.1
    this.maxDistance = options.maxDistance ?? 100
  }

  /**
   * 按包围球半径把相机放到刚好看全模型的位置。
   * 竖屏手机上水平视角比垂直视角小,取两者中较小的一个,否则球体会被左右裁掉。
   */
  fit(radius: number, fovDeg = 45, aspect = 1): void {
    const safeRadius = Math.max(radius, 1e-4)
    const verticalHalf = (fovDeg * Math.PI) / 360
    const horizontalHalf = Math.atan(Math.tan(verticalHalf) * Math.max(aspect, 1e-3))
    const half = Math.min(verticalHalf, horizontalHalf)

    this.minDistance = safeRadius * 0.6
    this.maxDistance = safeRadius * 12
    this.distance = (safeRadius / Math.sin(half)) * 1.15
  }

  /** dx/dy 是画布上的像素位移,viewportHeight 用来把拖动距离换算成角度(满屏拖动 ≈ 180°) */
  rotate(dx: number, dy: number, viewportHeight: number): void {
    const scale = Math.PI / Math.max(viewportHeight, 1)
    // 与 OrbitControls 一致:向右拖 azimuth 减小,向下拖 polar 减小(相机抬高)
    this.azimuth -= dx * scale
    this.polar = clamp(this.polar - dy * scale, MIN_POLAR, MAX_POLAR)
  }

  /** factor < 1 拉近,factor > 1 拉远 */
  zoom(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      return
    }
    this.setDistance(this.distance * factor)
  }

  setDistance(distance: number): void {
    this.distance = clamp(distance, this.minDistance, this.maxDistance)
  }

  getDistance(): number {
    return this.distance
  }

  getTarget(): [number, number, number] {
    return [...this.target]
  }

  getPosition(): [number, number, number] {
    const { azimuth, polar, distance } = this
    const sinPolar = Math.sin(polar)
    return [
      this.target[0] + distance * sinPolar * Math.sin(azimuth),
      this.target[1] + distance * Math.cos(polar),
      this.target[2] + distance * sinPolar * Math.cos(azimuth),
    ]
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
