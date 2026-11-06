<script setup lang="ts">
import type { CanvasAdapter, PointerPhase } from '@/renderer'
import { createPerfMesh } from '@/mesh/generate'
import { createCanvasAdapter, MeshViewer } from '@/renderer'

definePage({
  style: {
    navigationBarTitleText: '3D 渲染验证',
    navigationBarBackgroundColor: '#0f1419',
    navigationBarTextStyle: 'white',
    backgroundColor: '#0f1419',
  },
})

/** W0 验证用:同一套渲染代码在小程序 / H5 上跑不同面数,看帧率 */
const PRESETS = [10_000, 50_000, 200_000] as const

/**
 * 页面高度:H5 的 uni-page-body 从导航栏下面开始,直接 100vh 会多出导航栏高度;
 * --window-top / --window-bottom 是 uni-app 在 H5/APP 上提供的可用区变量,小程序退化成 100vh。
 */
const rootStyle = (() => {
  // #ifdef H5
  return 'height: calc(100vh - var(--window-top, 0px) - var(--window-bottom, 0px))'
  // #endif
  // #ifndef H5
  return 'height: 100vh'
  // #endif
})()

const target = ref<number>(50_000)
const stats = ref({ fps: 0, triangles: 0, dpr: 1 })
const wireframe = ref(false)
const ready = ref(false)
const errorMessage = ref('')

let adapter: CanvasAdapter | undefined
let viewer: MeshViewer | undefined
let unloaded = false

onReady(() => {
  void initViewer()
})

onUnload(() => {
  unloaded = true
  viewer?.dispose()
  viewer = undefined
  adapter = undefined
})

async function initViewer(): Promise<void> {
  if (viewer) {
    return
  }
  try {
    adapter = createCanvasAdapter({
      hostSelector: '#mesh-host',
      canvasSelector: '#mesh-canvas',
    })
    const created = await MeshViewer.create({
      adapter,
      onStats: (next) => {
        stats.value = next
      },
    })
    // 初始化是异步的,期间页面可能已经退出
    if (unloaded) {
      created.dispose()
      return
    }
    viewer = created
    viewer.setMesh(createPerfMesh(target.value))
    ready.value = true
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

function switchPreset(triangles: number): void {
  if (!viewer || target.value === triangles) {
    return
  }
  target.value = triangles
  stats.value = { fps: 0, triangles: 0, dpr: stats.value.dpr }
  viewer.setMesh(createPerfMesh(triangles))
}

function toggleWireframe(): void {
  wireframe.value = !wireframe.value
  viewer?.setWireframe(wireframe.value)
}

function resetCamera(): void {
  viewer?.resetCamera()
}

function onTouch(phase: PointerPhase, event: unknown): void {
  adapter?.feedPointer(phase, event)
}

function formatTriangles(value: number): string {
  return value >= 10_000 ? `${(value / 10_000).toFixed(1)} 万` : `${value}`
}
</script>

<template>
  <view class="flex flex-col bg-[#0f1419]" :style="rootStyle">
    <!-- #ifdef H5 -->
    <!-- H5:适配器自己往这个容器里插原生 canvas,不经过 uni canvas 封装 -->
    <view id="mesh-host" class="w-full flex-1 overflow-hidden" />
    <!-- #endif -->

    <!-- #ifdef MP-WEIXIN -->
    <!-- 小程序:原生 canvas,节点由 SelectorQuery 取;触摸事件从模板转交给适配器 -->
    <view class="w-full flex-1 overflow-hidden">
      <canvas
        id="mesh-canvas"
        type="webgl"
        class="h-full w-full"
        disable-scroll
        @touchstart="onTouch('start', $event)"
        @touchmove="onTouch('move', $event)"
        @touchend="onTouch('end', $event)"
        @touchcancel="onTouch('end', $event)"
      />
    </view>
    <!-- #endif -->

    <view class="shrink-0 border-t border-white/10 bg-black/40 px-3 pt-2 pb-safe">
      <view class="flex items-center justify-between text-xs text-white/70">
        <text>{{ ready ? '单指旋转 · 双指缩放' : '初始化中…' }}</text>
        <text>{{ stats.fps.toFixed(0) }} FPS</text>
      </view>
      <view class="mt-1 flex items-center justify-between text-xs text-white/50">
        <text>面数 {{ formatTriangles(stats.triangles) }}</text>
        <text>DPR {{ stats.dpr.toFixed(2) }}</text>
      </view>
      <view class="mt-2 flex flex-wrap gap-2">
        <view
          v-for="preset in PRESETS"
          :key="preset"
          class="rounded-full px-3 py-1 text-xs"
          :class="preset === target ? 'bg-primary text-white' : 'bg-white/10 text-white/80'"
          @tap="switchPreset(preset)"
        >
          {{ formatTriangles(preset) }} 面
        </view>
        <view class="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80" @tap="toggleWireframe">
          {{ wireframe ? '实体' : '线框' }}
        </view>
        <view class="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80" @tap="resetCamera">
          复位
        </view>
      </view>
      <view v-if="errorMessage" class="mt-2 text-xs text-red-400">
        {{ errorMessage }}
      </view>
    </view>
  </view>
</template>
