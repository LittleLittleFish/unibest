import type { TabBar } from '@uni-helper/vite-plugin-uni-pages'
import type { UserRole } from '@/api/types/login'
import type { RemoveLeadingSlashFromUnion } from '@/typings'

/**
 * 生成的 _LocationUrl 只包含「非 tabBar 页面」,tabBar 页面在 SwitchTabOptions 里。
 * 页面一多(出现第一个非 tabBar 页面后)_LocationUrl 就从 string 收窄成字面量联合,
 * 不并上 tabBar 页面的话,本文件下面的 pagePath 会全部报类型错误。
 */
type TabBarPagePath = SwitchTabOptions extends { url: infer Url }
  ? (Url extends string ? Url : never)
  : never

/** tabbar 可用的页面路径(去掉开头的 /) */
export type PagePath = RemoveLeadingSlashFromUnion<_LocationUrl | TabBarPagePath>

/**
 * 原生 tabbar 的单个选项配置
 */
export type NativeTabBarItem = TabBar['list'][number] & {
  pagePath: PagePath
}

/** badge 显示一个数字或 小红点（样式可以直接在 tabbar/index.vue 里面修改） */
export type CustomTabBarItemBadge = number | 'dot'

/** 自定义 tabbar 的单个选项配置 */
export interface CustomTabBarItem {
  text: string
  pagePath: PagePath
  /** 图标类型，不建议用 image 模式，因为需要配置 2 张图，更麻烦 */
  iconType: 'uiLib' | 'unocss' | 'iconfont' | 'image'
  /**
   * icon 的路径
   * - uiLib: wot-design-uni 图标的 icon prop
   * - unocss: unocss 图标的类名
   * - iconfont: iconfont 图标的类名
   * - image: 图片的路径
   */
  icon: string
  /** 只有在 image 模式下才需要，传递的是高亮的图片 */
  iconActive?: string
  /** badge 显示一个数字或 小红点 */
  badge?: CustomTabBarItemBadge
  /** 是否是中间的鼓包tabbarItem */
  isBulge?: boolean
  // roles 不写 → 所有用户都能看到；roles 写了 → 只有匹配角色可见
  roles?: UserRole[]
}
