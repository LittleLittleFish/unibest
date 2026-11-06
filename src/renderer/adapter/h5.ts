import type {
  CanvasAdapter,
  CanvasInputEvent,
  CanvasInputHandler,
  CanvasLike,
  CanvasSize,
  PointerPhase,
  PointerPoint,
} from '../types'

interface H5AdapterOptions {
  /** 承载 canvas 的容器 id;canvas 节点由适配器自己创建,绕开 uni-app 对 canvas 的封装 */
  hostSelector: string
}

interface PointerLikeEvent {
  clientX: number
  clientY: number
}

interface TouchLike {
  x?: number
  y?: number
  clientX?: number
  clientY?: number
}

interface TouchEventLike {
  touches?: TouchLike[]
}

/**
 * H5 适配器:直接用 DOM canvas。
 * 不依赖 uni-app 的 <canvas> 组件,拿到的是原生 canvas,three 无需任何 shim。
 */
export function createH5CanvasAdapter(options: H5AdapterOptions): CanvasAdapter {
  let host: HTMLElement | undefined
  let canvas: HTMLCanvasElement | undefined
  let size: CanvasSize = { width: 1, height: 1, dpr: 1 }
  let handler: CanvasInputHandler | undefined
  let disposed = false

  const activePointers = new Map<number, PointerPoint>()

  function emit(event: CanvasInputEvent): void {
    handler?.(event)
  }

  function toLocalPoint(event: PointerLikeEvent): PointerPoint {
    const rect = canvas?.getBoundingClientRect()
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    }
  }

  function syncSize(): void {
    if (!host || !canvas) {
      return
    }
    const width = Math.max(1, host.clientWidth)
    const height = Math.max(1, host.clientHeight)
    // 手机 dpr 常有 3,夹到 2 以内,像素数少一半
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    size = { width, height, dpr }
  }

  function onPointerDown(event: PointerEvent): void {
    if (!canvas) {
      return
    }
    canvas.setPointerCapture?.(event.pointerId)
    activePointers.set(event.pointerId, toLocalPoint(event))
    emit({ type: 'pointer', phase: 'start', points: Array.from(activePointers.values()) })
  }

  function onPointerMove(event: PointerEvent): void {
    if (!activePointers.has(event.pointerId)) {
      return
    }
    activePointers.set(event.pointerId, toLocalPoint(event))
    emit({ type: 'pointer', phase: 'move', points: Array.from(activePointers.values()) })
  }

  function onPointerEnd(event: PointerEvent): void {
    if (!activePointers.delete(event.pointerId)) {
      return
    }
    emit({ type: 'pointer', phase: 'end', points: Array.from(activePointers.values()) })
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault()
    emit({ type: 'wheel', delta: event.deltaY, point: toLocalPoint(event) })
  }

  async function init(): Promise<CanvasSize> {
    host = document.querySelector<HTMLElement>(options.hostSelector) ?? undefined
    if (!host) {
      throw new Error(`[renderer] 找不到 canvas 宿主节点: ${options.hostSelector}`)
    }

    canvas = document.createElement('canvas')
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.touchAction = 'none'
    host.appendChild(canvas)

    syncSize()
    if (size.width <= 1 || size.height <= 1) {
      // 布局还没算完(比如 display:none 的容器),等一帧再量
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
      syncSize()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerEnd)
    canvas.addEventListener('pointercancel', onPointerEnd)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    return size
  }

  function feedPointer(phase: PointerPhase, event: unknown): void {
    // H5 走 DOM 事件,这里只做兼容:模板里若绑了 touch 事件也能用
    const touches = (event as TouchEventLike | undefined)?.touches ?? []
    const points = touches.map((touch) => {
      if (typeof touch.clientX === 'number' && typeof touch.clientY === 'number') {
        return toLocalPoint({ clientX: touch.clientX, clientY: touch.clientY })
      }
      return { x: touch.x ?? 0, y: touch.y ?? 0 }
    })
    emit({ type: 'pointer', phase, points })
  }

  return {
    get canvas(): CanvasLike {
      if (!canvas) {
        throw new Error('[renderer] canvas 尚未 init')
      }
      return canvas as unknown as CanvasLike
    },
    init,
    getSize: () => size,
    onInput: (next) => {
      handler = next
    },
    feedPointer,
    requestFrame: callback => (disposed ? 0 : window.requestAnimationFrame(callback)),
    cancelFrame: id => window.cancelAnimationFrame(id),
    dispose: () => {
      if (disposed) {
        return
      }
      disposed = true
      handler = undefined
      activePointers.clear()

      canvas?.removeEventListener('pointerdown', onPointerDown)
      canvas?.removeEventListener('pointermove', onPointerMove)
      canvas?.removeEventListener('pointerup', onPointerEnd)
      canvas?.removeEventListener('pointercancel', onPointerEnd)
      canvas?.removeEventListener('wheel', onWheel)
      canvas?.remove()
      canvas = undefined
      host = undefined
    },
  }
}
