// #ifdef H5
import { createH5CanvasAdapter } from './h5'
// #endif

// #ifdef MP-WEIXIN
import { createMpCanvasAdapter } from './mp-weixin'
// #endif

import type { CanvasAdapter } from '../types'

export interface CanvasAdapterOptions {
  /** H5:承载 canvas 的容器 id(适配器自己创建 canvas 节点) */
  hostSelector?: string
  /** 小程序:<canvas> 节点 id */
  canvasSelector?: string
}

/**
 * 平台适配器入口:条件编译在构建期裁掉其他平台的分支。
 * 目前实现 H5 与微信小程序;APP 端(renderjs / 原生插件)与支付宝等小程序需另写适配器。
 */
export function createCanvasAdapter(options: CanvasAdapterOptions): CanvasAdapter {
  // #ifdef H5
  return createH5CanvasAdapter({ hostSelector: options.hostSelector ?? '#mesh-host' })
  // #endif

  // #ifdef MP-WEIXIN
  return createMpCanvasAdapter({ canvasSelector: options.canvasSelector ?? '#mesh-canvas' })
  // #endif

  // #ifndef H5
  // #ifndef MP-WEIXIN
  throw new Error('[renderer] 当前平台还没接入渲染适配层,已支持:H5 / MP-WEIXIN')
  // #endif
  // #endif
}
