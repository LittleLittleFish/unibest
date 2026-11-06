import { describe, expect, it } from 'vitest'
import { OrbitCamera } from './orbit'

describe('orbit camera', () => {
  it('fit 后相机距离足以容纳包围球(竖屏也不裁切)', () => {
    const orbit = new OrbitCamera()
    orbit.fit(1, 45, 0.53)

    const [x, y, z] = orbit.getPosition()
    const distance = Math.hypot(x, y, z)
    // 水平半视角 = atan(tan(22.5°) * 0.53) ≈ 12.4°,球体半径 1 需要 distance >= 1/sin(12.4°)
    expect(distance).toBeGreaterThan(1 / Math.sin((12.4 * Math.PI) / 180))
  })

  it('rotate 会改变方位角,并把极角夹在 (0, π) 内', () => {
    const orbit = new OrbitCamera()
    const azimuthBefore = orbit.azimuth

    orbit.rotate(120, 0, 800)
    expect(orbit.azimuth).toBeLessThan(azimuthBefore)

    orbit.rotate(0, 100_000, 800)
    expect(orbit.polar).toBeGreaterThan(0)
    expect(orbit.polar).toBeLessThan(Math.PI)

    orbit.rotate(0, -100_000, 800)
    expect(orbit.polar).toBeGreaterThan(0)
    expect(orbit.polar).toBeLessThan(Math.PI)
  })

  it('zoom 夹在 min/max 距离之间,非法输入被忽略', () => {
    const orbit = new OrbitCamera()
    orbit.fit(1, 45, 1)

    // fit(1) 后 minDistance = 0.6 * 半径,maxDistance = 12 * 半径
    orbit.zoom(0.01)
    expect(orbit.getDistance()).toBeCloseTo(0.6, 5)

    orbit.zoom(100)
    expect(orbit.getDistance()).toBeCloseTo(12, 5)

    const before = orbit.getDistance()
    orbit.zoom(Number.NaN)
    orbit.zoom(-1)
    expect(orbit.getDistance()).toBe(before)
  })

  it('相机到目标点的距离等于当前 distance', () => {
    const orbit = new OrbitCamera()
    orbit.fit(2, 45, 1)
    const distance = orbit.getDistance()

    const [x, y, z] = orbit.getPosition()
    expect(Math.hypot(x, y, z)).toBeCloseTo(distance, 5)
  })
})
