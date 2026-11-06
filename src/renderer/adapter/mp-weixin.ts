import type {
  CanvasAdapter,
  CanvasInputHandler,
  CanvasLike,
  CanvasSize,
  PointerPhase,
  PointerPoint,
} from '../types'

interface MpAdapterOptions {
  /** 模板里 <canvas> 的 id 选择器,如 '#mesh-canvas' */
  canvasSelector: string
}

/** 微信小程序 canvas 节点(非 DOM,只有 getContext / 尺寸 / 逐帧回调) */
interface MpCanvasNode {
  width: number
  height: number
  getContext: (type: string, attributes?: Record<string, unknown>) => unknown
  requestAnimationFrame?: (callback: (time: number) => void) => number
  cancelAnimationFrame?: (id: number) => void
}

interface MpNodeInfo {
  node?: MpCanvasNode
  width?: number
  height?: number
  left?: number
  top?: number
}

interface MpTouch {
  x?: number
  y?: number
  clientX?: number
  clientY?: number
}

interface MpTouchEvent {
  /** 当前仍按在屏幕上的手指;touchend 时就是剩余手指数 */
  touches?: MpTouch[]
}

const QUERY_TIMEOUT = 3000

/**
 * 微信小程序适配器。
 *
 * 三处和 H5 不一样:
 * 1. canvas 节点通过 SelectorQuery 异步取,必须在 onReady 之后;
 * 2. 节点不是 DOM,包一层门面满足 three 对 width/getContext/addEventListener 的调用;
 * 3. 没有 window.requestAnimationFrame / DOM 事件,逐帧用 canvas.requestAnimationFrame,指针事件从模板事件转交。
 */
export function createMpCanvasAdapter(options: MpAdapterOptions): CanvasAdapter {
  let node: MpCanvasNode | undefined
  let origin = { left: 0, top: 0 }
  let size: CanvasSize = { width: 1, height: 1, dpr: 1 }
  let handler: CanvasInputHandler | undefined
  let disposed = false

  const timerIds = new Set<number>()

  // three 只用到这几项,不必（也没有）完整 DOM 节点
  const facade: CanvasLike = {
    get width() {
      return node?.width ?? 0
    },
    set width(value: number) {
      if (node) {
        node.width = value
      }
    },
    get height() {
      return node?.height ?? 0
    },
    set height(value: number) {
      if (node) {
        node.height = value
      }
    },
    getContext(type: string, attributes?: Record<string, unknown>) {
      if (!node) {
        throw new Error('[renderer] canvas 节点未就绪,先 await init()')
      }
      return node.getContext(type, attributes)
    },
    // 小程序 canvas 没有上下文丢失事件;three 注册时给空实现即可
    addEventListener() {},
    removeEventListener() {},
  }

  function queryCanvas(): Promise<MpNodeInfo> {
    return new Promise((resolve, reject) => {
      let settled = false
      const timer = setTimeout(() => {
        if (settled) {
          return
        }
        settled = true
        reject(new Error(`[renderer] 取 canvas 节点超时: ${options.canvasSelector}`))
      }, QUERY_TIMEOUT)

      uni
        .createSelectorQuery()
        .select(options.canvasSelector)
        .fields({ node: true, size: true, rect: true }, (result) => {
          if (settled) {
            return
          }
          settled = true
          clearTimeout(timer)
          resolve(result as unknown as MpNodeInfo)
        })
        .exec()
    })
  }

  async function init(): Promise<CanvasSize> {
    const info = await queryCanvas()
    const canvasNode = info.node
    if (!canvasNode) {
      throw new Error(
        `[renderer] 未取到 canvas 节点: ${options.canvasSelector}。`
        + '检查 <canvas id>、type="webgl",以及是否在 onReady 之后调用 init()',
      )
    }

    const width = Math.max(1, Math.round(info.width ?? 0))
    const height = Math.max(1, Math.round(info.height ?? 0))
    // 手机 dpr 常有 3,夹到 2 以内,像素数少一半
    const dpr = Math.min(uni.getWindowInfo().pixelRatio || 1, 2)

    canvasNode.width = Math.round(width * dpr)
    canvasNode.height = Math.round(height * dpr)

    node = canvasNode
    origin = { left: info.left ?? 0, top: info.top ?? 0 }
    size = { width, height, dpr }
    return size
  }

  function feedPointer(phase: PointerPhase, event: unknown): void {
    const touches = (event as MpTouchEvent | undefined)?.touches ?? []
    const points: PointerPoint[] = touches.map((touch) => {
      if (typeof touch.x === 'number' && typeof touch.y === 'number') {
        // 小程序 canvas 的触摸事件给的就是相对 canvas 左上角的坐标
        return { x: touch.x, y: touch.y }
      }
      return {
        x: (touch.clientX ?? 0) - origin.left,
        y: (touch.clientY ?? 0) - origin.top,
      }
    })

    handler?.({ type: 'pointer', phase, points })
  }

  function requestFrame(callback: () => void): number {
    if (disposed) {
      return 0
    }
    const raf = node?.requestAnimationFrame
    if (raf && node) {
      return raf.call(node, () => callback())
    }

    const id = setTimeout(() => {
      timerIds.delete(id)
      callback()
    }, 16) as unknown as number
    timerIds.add(id)
    return id
  }

  function cancelFrame(id: number): void {
    if (timerIds.delete(id)) {
      clearTimeout(id)
      return
    }
    node?.cancelAnimationFrame?.(id)
  }

  return {
    canvas: facade,
    init,
    getSize: () => size,
    onInput: (next) => {
      handler = next
    },
    feedPointer,
    requestFrame,
    cancelFrame,
    dispose: () => {
      disposed = true
      handler = undefined
      timerIds.forEach(id => clearTimeout(id))
      timerIds.clear()
      node = undefined
    },
  }
}
