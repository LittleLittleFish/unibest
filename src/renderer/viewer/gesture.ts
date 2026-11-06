import type { CanvasInputEvent, PointerPoint } from '../types'
import type { OrbitCamera } from './orbit'

function distance(a: PointerPoint, b: PointerPoint): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

/**
 * 手势 → 相机。单指旋转、双指捏合缩放、滚轮缩放。
 * 只处理「位移」,不碰平台事件,方便以后换成别的渲染后端。
 */
export class OrbitGesture {
  private lastPoints: PointerPoint[] | null = null

  constructor(
    private readonly orbit: OrbitCamera,
    private readonly getViewportHeight: () => number,
  ) {}

  handle(event: CanvasInputEvent): void {
    if (event.type === 'wheel') {
      // 向下滚(delta > 0)拉远
      this.orbit.zoom(Math.exp(event.delta * 0.001))
      return
    }

    if (event.phase === 'end' || event.points.length === 0) {
      this.lastPoints = null
      return
    }

    const last = this.lastPoints
    if (last && last.length === event.points.length) {
      if (event.points.length === 1) {
        this.orbit.rotate(
          event.points[0].x - last[0].x,
          event.points[0].y - last[0].y,
          this.getViewportHeight(),
        )
      }
      else {
        const before = distance(last[0], last[1])
        const after = distance(event.points[0], event.points[1])
        // 两指张开(after 变大)→ factor < 1 → 拉近
        if (before > 0 && after > 0) {
          this.orbit.zoom(before / after)
        }
      }
    }

    this.lastPoints = event.points.map(point => ({ x: point.x, y: point.y }))
  }

  reset(): void {
    this.lastPoints = null
  }
}
