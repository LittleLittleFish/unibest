# 渲染模块(three.js)

> 对应《三维网格工具-跨端方案》里的 `packages/renderer` + `packages/mesh-core`。
> 本项目先按目录分层落地(不拆 monorepo),边界按包的边界划,后续可整目录搬走。

## 1. 分层与边界

```
src/
├── mesh/                  # 纯数据 + 纯算法:只吃 Uint8Array/Float32Array,不认平台、不认 three
│   ├── types.ts           # MeshData(positions/indices/normals)、Bounds
│   ├── bounds.ts          # 包围盒 / 包围球
│   └── generate.ts        # 程序化网格(性能验证用)
└── renderer/              # 渲染层:唯一 import three 的地方
    ├── types.ts           # CanvasAdapter / CanvasLike / CanvasInputEvent(平台接缝)
    ├── adapter/
    │   ├── index.ts       # 条件编译选平台实现
    │   ├── h5.ts          # DOM canvas + pointer/wheel
    │   └── mp-weixin.ts   # canvas 节点 + 门面 + touch 转交
    └── viewer/
        ├── mesh-viewer.ts # 场景/相机/灯光/材质/循环/统计
        ├── orbit.ts       # 球坐标相机(纯数学,可单测)
        └── gesture.ts     # 单指旋转 / 双指捏合 / 滚轮
```

规则:

- **页面不 import three**,只 import `@/renderer`;three 只在 `src/renderer/viewer/**` 出现
- **算法不 import three**,`src/mesh/**` 保持可搬进 worker / wasm / node 脚本
- **平台差异只写在 adapter**,渲染核心不出现 `#ifdef`

## 2. 依赖与版本锁

```jsonc
"dependencies": { "three": "0.162.0" },          // 锁版本,不要 ^
"devDependencies": { "@types/three": "0.162.0" }
```

**为什么锁 r162**:r163 移除了 WebGL1 支持,而微信小程序 `canvas type="webgl"` 只提供 WebGL1。
升级 three 等于放弃小程序,任何 `pnpm update` 后都要确认 `three` 还是 0.162.0。

## 3. 页面接入三步

```vue
<script setup lang="ts">
import type { CanvasAdapter, PointerPhase } from '@/renderer'
import { createPerfMesh } from '@/mesh/generate'
import { createCanvasAdapter, MeshViewer } from '@/renderer'

let adapter: CanvasAdapter | undefined
let viewer: MeshViewer | undefined

onReady(async () => {                       // ① 必须 onReady 之后,节点才存在
  adapter = createCanvasAdapter({
    hostSelector: '#mesh-host',              // H5:容器 id(适配器自己插 canvas)
    canvasSelector: '#mesh-canvas',          // 小程序:<canvas> id
  })
  viewer = await MeshViewer.create({         // ② 建渲染器(内部取节点、定 dpr、起循环)
    adapter,
    onStats: stats => { /* FPS / 面数 / dpr */ },
  })
  viewer.setMesh(createPerfMesh(50_000))     // ③ 换网格,自动取景
})

onUnload(() => viewer?.dispose())            // 必须 dispose,否则 WebGL 上下文泄漏
</script>

<template>
  <!-- #ifdef H5 -->
  <view id="mesh-host" class="w-full flex-1 overflow-hidden" />
  <!-- #endif -->
  <!-- #ifdef MP-WEIXIN -->
  <canvas
    id="mesh-canvas" type="webgl" class="h-full w-full" disable-scroll
    @touchstart="adapter?.feedPointer('start', $event)"
    @touchmove="adapter?.feedPointer('move', $event)"
    @touchend="adapter?.feedPointer('end', $event)"
  />
  <!-- #endif -->
</template>
```

可直接运行的验证页:`src/pages/renderer/index.vue`(1 万 / 5 万 / 20 万面切换 + 线框 + FPS)。

打开方式:

- H5:`pnpm dev` → `http://localhost:9000/#/pages/renderer/index`
- 小程序:导入 `dist/build/mp-weixin`,开发者工具「编译模式」里把页面路径设成 `pages/renderer/index`
  (页面没挂 tabbar,也没有别的入口,避免影响现有首页)

## 4. 平台差异(渲染层唯一差异点)

| 事项 | H5 | 微信小程序 |
|------|----|-----------|
| canvas 来源 | 适配器 `document.createElement('canvas')` 插进容器 | `SelectorQuery.fields({node:true})` 异步取节点 |
| 给 three 的对象 | 原生 `HTMLCanvasElement` | **门面对象**:代理 width/height/getContext,补空 `addEventListener` |
| 上下文 | WebGL2 优先,`WebGLRenderer` | 只有 WebGL1,用 `WebGL1Renderer` 只请求 `webgl` |
| 指针事件 | DOM `pointerdown/move/up` + `wheel` | 模板 `@touch*` 转交 `feedPointer`,坐标取 `touches[i].x/y` |
| 逐帧 | `window.requestAnimationFrame` | `canvas.requestAnimationFrame`,没有就 16ms 定时器兜底 |
| dpr | `window.devicePixelRatio`,夹到 2 | `uni.getWindowInfo().pixelRatio`,夹到 2 |

新增平台 = 新增一个 adapter + 在 `adapter/index.ts` 加一个条件编译分支,渲染核心零改动。

## 5. 小程序的坑(踩过再回来看)

1. **节点查询必须在 `onReady` 之后**。`onLoad` 里查是 `undefined`,本项目 adapter 会报 "未取到 canvas 节点"。
2. **只有 WebGL1**。不要用 WebGL2 语法、`sampler3D`、MRT、实例化渲染的 WebGL2 路径;shader 按 GLSL ES 1.00 写。
3. **32 位索引要扩展**。`Uint32Array` 索引在 WebGL1 依赖 `OES_element_index_uint`;不支持时 >65535 顶点要分块。viewer 里 `warnIfIndexUnsupported` 会打告警。
4. **canvas 是原生组件**。HUD/按钮不要压在 canvas 上(老基础库会盖不住),本项目把状态栏和控制条放在 canvas 下方的正常文档流里。要浮层就用 `cover-view`,或等基础库同层渲染。
5. **WebGL 不支持真机调试**,只能用真机预览;模拟器和真机帧率差很多,性能只能真机看。
6. **包体**:three 压缩后约 500KB,主包上限 2MB。当前主包约 860KB,后续接 STL 解析 + 分包时留意。
7. **H5 的高度别直接写 `100vh`**:`uni-page-body` 从导航栏下面开始,`100vh` 会多出导航栏高度、底部按钮被裁。
   用 `calc(100vh - var(--window-top, 0px) - var(--window-bottom, 0px))`(H5/APP 有这两个变量,小程序退化成 100vh)。
8. **canvas 的宽高由 CSS 决定**,适配器按 `fields({size:true})` 拿到的 CSS 像素 × dpr 设缓冲区,和 three 的 `setSize(w,h,false)` 对齐。

## 6. 不要做

- 不要在页面/组件里 `import ... from 'three'`,会绕过 adapter 的初始化顺序,且破坏"渲染代码只有一处"的约束
- 不要引入依赖 `document` 的 three 扩展:`GLTFLoader`、`TextureLoader`、`OrbitControls` 都会碰 DOM/事件系统
  - 轨道相机用本项目的 `OrbitCamera` + `OrbitGesture`
  - 纹理/模型文件先自己解析成 `MeshData`,再交给 viewer
- 不要把 three 的 `setAnimationLoop` 当主循环(它内部用 `self.requestAnimationFrame`,小程序没有 `self`)

## 7. 验证

```bash
pnpm type-check && pnpm lint && pnpm test:run   # 合入门禁
pnpm build:h5                                   # 产物 dist/build/h5
SKIP_OPEN_DEVTOOLS=true pnpm build:mp           # 产物 dist/build/mp-weixin
```

条件编译是否裁干净(两条都应无输出):

```bash
grep -rl "取 canvas 节点超时" dist/build/h5/assets     # H5 不该有小程序适配器
grep -rl 'createElement("canvas")' dist/build/mp-weixin # 小程序不该有 H5 适配器
```

小程序端只能真机验证:导入 `dist/build/mp-weixin` → 预览 → 手机上看 FPS 与手势。

## 8. 后续(按跨端方案文档的顺序)

| 事项 | 落点 | 备注 |
|------|------|------|
| STL/OBJ 解析 | `src/mesh/io/` | 自己解析成 `MeshData`,不引 three 的 loader |
| 聊天文件导入 | 平台层 `FilePort` | `wx.chooseMessageFile` / H5 `<input type=file>` |
| 大模型分块 | `src/renderer/viewer/` | 按 65535 顶点切块,规避 WebGL1 索引限制 |
| 拾取 | viewer | GPU picking 优先,raycast 兜底 |
| APP 端 | 新 adapter | app-vue 需要 renderjs,不能在 webview 里直接拿原生 canvas |
| 拆包 | monorepo | `src/mesh` → `packages/mesh-core`,`src/renderer` → `packages/renderer` |
