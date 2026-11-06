import type { MeshData } from '@/mesh/types'
import { computeBounds } from '@/mesh/bounds'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  WebGL1Renderer,
  WebGLRenderer,
} from 'three'
import type { CanvasAdapter, CanvasInputEvent, CanvasLike } from '../types'
import { OrbitGesture } from './gesture'
import { OrbitCamera } from './orbit'

export interface MeshViewerStats {
  fps: number
  triangles: number
  dpr: number
}

export interface MeshViewerOptions {
  adapter: CanvasAdapter
  /** 背景色,默认 #0f1419 */
  background?: number
  /** 每 500ms 回调一次,用于把帧率显示到页面 */
  onStats?: (stats: MeshViewerStats) => void
}

const FOV = 45
const STATS_INTERVAL = 500

/**
 * 渲染核心:只认 CanvasAdapter + MeshData。
 * 所有 three 相关代码集中在这里,页面与业务不直接 import three。
 */
function createRenderer(canvas: CanvasLike): WebGLRenderer {
  const parameters = {
    canvas: canvas as unknown as HTMLCanvasElement,
    alpha: false,
    antialias: true,
    powerPreference: 'high-performance' as const,
  }

  // #ifdef MP-WEIXIN
  // 小程序只有 WebGL1:用 WebGL1Renderer 明确只请求 'webgl'(WebGLRenderer 会先试 webgl2),并关掉 MSAA 省带宽
  return new WebGL1Renderer({ ...parameters, antialias: false })
  // #endif

  // #ifndef MP-WEIXIN
  return new WebGLRenderer(parameters)
  // #endif
}

export class MeshViewer {
  private readonly adapter: CanvasAdapter
  private readonly renderer: WebGLRenderer
  private readonly scene: Scene
  private readonly camera: PerspectiveCamera
  private readonly material: MeshLambertMaterial
  private readonly orbit: OrbitCamera
  private readonly gesture: OrbitGesture
  private readonly onStats?: (stats: MeshViewerStats) => void

  private mesh: Mesh | undefined
  private modelRadius = 1
  private viewportAspect = 1
  private triangleCount = 0
  private frameId = 0
  private running = false
  private frames = 0
  private statsSince = 0

  private constructor(options: MeshViewerOptions, width: number, height: number, dpr: number) {
    this.adapter = options.adapter
    this.onStats = options.onStats

    this.renderer = createRenderer(options.adapter.canvas)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(width, height, false)

    this.scene = new Scene()
    this.scene.background = new Color(options.background ?? 0x0F1419)

    this.viewportAspect = width / Math.max(height, 1)
    this.camera = new PerspectiveCamera(FOV, this.viewportAspect, 0.01, 1000)

    this.orbit = new OrbitCamera()
    this.gesture = new OrbitGesture(this.orbit, () => this.adapter.getSize().height)

    this.material = new MeshLambertMaterial({ color: 0xA8BFD8 })

    const hemisphere = new HemisphereLight(0xFFFFFF, 0x2B3440, 1.6)
    const keyLight = new DirectionalLight(0xFFFFFF, 2.2)
    keyLight.position.set(1.2, 2, 1.6)
    const fillLight = new DirectionalLight(0xFFFFFF, 0.8)
    fillLight.position.set(-2, -1, -1.5)
    this.scene.add(hemisphere, keyLight, fillLight)

    this.adapter.onInput(this.handleInput)
    this.updateCamera()
    this.start()
  }

  static async create(options: MeshViewerOptions): Promise<MeshViewer> {
    const size = await options.adapter.init()
    return new MeshViewer(options, size.width, size.height, size.dpr)
  }

  /** 换网格:重建几何体、把模型挪到原点、按包围球重新取景 */
  setMesh(data: MeshData): void {
    const bounds = computeBounds(data)

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(data.positions, 3))
    geometry.setIndex(new BufferAttribute(data.indices, 1))
    if (data.normals) {
      geometry.setAttribute('normal', new BufferAttribute(data.normals, 3))
    }
    else {
      geometry.computeVertexNormals()
    }
    geometry.computeBoundingSphere()

    this.warnIfIndexUnsupported(data.positions.length / 3)

    this.clearMesh()
    const mesh = new Mesh(geometry, this.material)
    mesh.position.set(-bounds.center[0], -bounds.center[1], -bounds.center[2])
    this.scene.add(mesh)

    this.mesh = mesh
    this.triangleCount = Math.floor(data.indices.length / 3)
    this.modelRadius = bounds.radius
    this.orbit.fit(bounds.radius, FOV, this.viewportAspect)
    this.updateCamera()
  }

  setWireframe(enabled: boolean): void {
    this.material.wireframe = enabled
  }

  resetCamera(): void {
    this.gesture.reset()
    this.orbit.fit(this.modelRadius, FOV, this.viewportAspect)
    this.updateCamera()
  }

  start(): void {
    if (this.running) {
      return
    }
    this.running = true
    this.frames = 0
    this.statsSince = Date.now()
    this.frameId = this.adapter.requestFrame(this.loop)
  }

  stop(): void {
    this.running = false
    if (this.frameId) {
      this.adapter.cancelFrame(this.frameId)
      this.frameId = 0
    }
  }

  dispose(): void {
    this.stop()
    this.clearMesh()
    this.material.dispose()
    this.renderer.dispose()
    this.adapter.dispose()
  }

  private loop = (): void => {
    if (!this.running) {
      return
    }
    this.frameId = this.adapter.requestFrame(this.loop)
    this.renderer.render(this.scene, this.camera)

    this.frames += 1
    const now = Date.now()
    const elapsed = now - this.statsSince
    if (elapsed >= STATS_INTERVAL) {
      this.onStats?.({
        fps: (this.frames * 1000) / elapsed,
        triangles: this.triangleCount,
        dpr: this.adapter.getSize().dpr,
      })
      this.frames = 0
      this.statsSince = now
    }
  }

  private handleInput = (event: CanvasInputEvent): void => {
    this.gesture.handle(event)
    this.updateCamera()
  }

  private updateCamera(): void {
    const [x, y, z] = this.orbit.getPosition()
    const [tx, ty, tz] = this.orbit.getTarget()
    this.camera.position.set(x, y, z)
    this.camera.lookAt(tx, ty, tz)
  }

  private clearMesh(): void {
    if (!this.mesh) {
      return
    }
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh = undefined
  }

  /** WebGL1 用 32 位索引需要 OES_element_index_uint;不支持时先告警,后续按顶点点数分块 */
  private warnIfIndexUnsupported(vertexCount: number): void {
    if (vertexCount <= 65536) {
      return
    }
    const context = this.renderer.getContext()
    if (typeof WebGL2RenderingContext !== 'undefined' && context instanceof WebGL2RenderingContext) {
      return
    }
    if (!context.getExtension('OES_element_index_uint')) {
      console.warn(
        `[renderer] 当前 WebGL1 上下文不支持 32 位索引,${vertexCount} 个顶点可能渲染异常;需要按 65535 顶点分块`,
      )
    }
  }
}
