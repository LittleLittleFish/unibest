/**
 * 渲染层的平台接缝。
 *
 * 约定:渲染核心(mesh-viewer)只依赖这里的接口,不认识 uni-app / 小程序 / DOM。
 * 每个平台实现一个 CanvasAdapter,把「拿到 canvas」「指针事件」「逐帧回调」三件事收敛掉。
 */

export interface CanvasSize {
  /** CSS 像素宽度(canvas 的显示宽度) */
  width: number
  /** CSS 像素高度 */
  height: number
  /** 设备像素比,写缓冲区分辨率 = width * dpr */
  dpr: number
}

/**
 * three.js r162 对 canvas 的全部依赖(见 WebGLRenderer 构造函数):
 * 读写 width/height、getContext、addEventListener/removeEventListener。
 * 小程序 canvas 不是 DOM 节点,由适配器包一层门面满足这三项。
 */
export interface CanvasLike {
  width: number
  height: number
  getContext: (type: string, attributes?: Record<string, unknown>) => unknown
  addEventListener: (type: string, listener: (event: never) => void, options?: boolean | Record<string, unknown>) => void
  removeEventListener: (type: string, listener: (event: never) => void, options?: boolean | Record<string, unknown>) => void
  style?: Record<string, string>
}

export interface PointerPoint {
  x: number
  y: number
}

export type PointerPhase = 'start' | 'move' | 'end'

/** 指针事件:单指拖动、双指捏合都归一化成这个 */
export interface PointerInput {
  type: 'pointer'
  phase: PointerPhase
  points: PointerPoint[]
}

/** H5 滚轮缩放 */
export interface WheelInput {
  type: 'wheel'
  delta: number
  point: PointerPoint
}

export type CanvasInputEvent = PointerInput | WheelInput

export type CanvasInputHandler = (event: CanvasInputEvent) => void

export interface CanvasAdapter {
  /** 交给 three 的 canvas(小程序端是门面对象) */
  readonly canvas: CanvasLike
  /** 拿节点、定尺寸,必须在页面 onReady 之后调用 */
  init: () => Promise<CanvasSize>
  getSize: () => CanvasSize
  /** 注册输入回调 */
  onInput: (handler: CanvasInputHandler) => void
  /**
   * 把平台原始事件喂进适配器。
   * H5 自行监听 DOM,不需要外部喂;小程序模板的事件绑定没有 DOM 事件流,由页面转交。
   */
  feedPointer: (phase: PointerPhase, event: unknown) => void
  requestFrame: (callback: () => void) => number
  cancelFrame: (id: number) => void
  dispose: () => void
}
