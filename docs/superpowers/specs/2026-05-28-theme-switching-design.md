# 深浅色模式切换功能设计文档

## 概述

为DeskZero应用添加深浅色模式切换功能，支持浅色/深色/跟随系统三种模式，并提供选中图标背景色和毛玻璃效果的配置选项。

## 设计目标

1. 支持三种主题模式：浅色、深色、跟随系统
2. 深色模式下选中图标的背景色和收纳盒容器颜色自动变为深色
3. 提供选中图标背景色配置（白色半透明/黑色半透明）
4. 提供选中图标背景色毛玻璃效果开关
5. 提供全局毛玻璃效果开关
6. 在设置-外观中配置所有选项

## 技术方案

### 1. 主题切换机制

**实现方式：**
- 使用`data-theme`属性在`<html>`元素上切换主题
- 扩展`globals.css`中的CSS变量定义
- 添加主题切换逻辑到`settingsStore.ts`

**CSS变量定义：**
```css
:root {
  /* 浅色主题（默认） */
  --color-bg: rgba(243, 243, 243, 0.88);
  --color-bg-hover: rgba(249, 249, 249, 0.92);
  --color-text: #1a1a1a;
  --color-text-secondary: #6b6b6b;
  --color-border: rgba(0, 0, 0, 0.06);
  --color-accent: #0078d4;
  --color-accent-subtle: rgba(0, 120, 212, 0.1);
  
  /* 选中图标背景色 */
  --item-selected-bg: rgba(255, 255, 255, 0.2);
  --item-selected-ring: rgba(255, 255, 255, 0.4);
  
  /* 毛玻璃效果 */
  --backdrop-blur: blur(30px);
  --backdrop-blur-light: blur(10px);
}

[data-theme="dark"] {
  --color-bg: rgba(32, 32, 32, 0.88);
  --color-bg-hover: rgba(44, 44, 44, 0.92);
  --color-text: #e8e8e8;
  --color-text-secondary: #999;
  --color-border: rgba(255, 255, 255, 0.06);
  
  /* 深色主题下的选中图标背景色 */
  --item-selected-bg: rgba(0, 0, 0, 0.3);
  --item-selected-ring: rgba(0, 0, 0, 0.5);
}
```

**主题切换逻辑：**
```typescript
// 在settingsStore.ts中
const applyTheme = (theme: Theme) => {
  const root = document.documentElement
  if (theme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    root.setAttribute('data-theme', systemTheme)
  } else {
    root.setAttribute('data-theme', theme)
  }
}
```

### 2. 选中图标背景色配置

**新增配置项：**
```typescript
// types/settings.ts
export interface Settings {
  // ... 现有配置
  selectedItemBackground: 'white' | 'black' // 选中图标背景色
  selectedItemBlur: boolean // 选中图标背景色毛玻璃效果
  globalBlur: boolean // 全局毛玻璃效果
}
```

**CSS变量扩展：**
```css
/* 用户自定义选中背景色 */
[data-selected-bg="white"] {
  --item-selected-bg: rgba(255, 255, 255, 0.2);
  --item-selected-ring: rgba(255, 255, 255, 0.4);
}

[data-selected-bg="black"] {
  --item-selected-bg: rgba(0, 0, 0, 0.3);
  --item-selected-ring: rgba(0, 0, 0, 0.5);
}

/* 选中图标毛玻璃效果 */
.selected-blur {
  backdrop-filter: var(--backdrop-blur-light);
  -webkit-backdrop-filter: var(--backdrop-blur-light);
}
```

**FileItem组件更新：**
```tsx
// components/Item/FileItem.tsx
import { useSettingsStore } from '@/stores/settingsStore'

export function FileItem({ item, className, onClick, onDoubleClick, onContextMenu }: FileItemProps) {
  const { settings } = useSettingsStore()
  // ... 现有代码
  
  return (
    <motion.div
      // ... 现有属性
      className={cn(
        "flex flex-col items-center justify-start p-2 rounded-md w-20 h-24 select-none touch-none",
        isDragging ? "opacity-50 cursor-grabbing" : "cursor-default hover:bg-white/10",
        isSelected && "bg-[var(--item-selected-bg)] ring-1 ring-[var(--item-selected-ring)]",
        isSelected && settings.selectedItemBlur && "selected-blur",
        className
      )}
    >
      // ... 现有内容
    </motion.div>
  )
}
```

### 3. 全局毛玻璃效果配置

**CSS变量扩展：**
```css
:root {
  /* 全局毛玻璃效果 */
  --backdrop-blur: blur(30px);
  --backdrop-blur-light: blur(10px);
  --backdrop-blur-none: blur(0px);
}

/* 全局毛玻璃效果控制 */
[data-global-blur="true"] {
  --backdrop-blur: blur(30px);
  --backdrop-blur-light: blur(10px);
}

[data-global-blur="false"] {
  --backdrop-blur: blur(0px);
  --backdrop-blur-light: blur(0px);
}
```

**Container组件更新：**
```tsx
// components/Container/Container.tsx
import { useSettingsStore } from '@/stores/settingsStore'

export function Container({ container }: ContainerProps) {
  const { settings } = useSettingsStore()
  // ... 现有代码
  
  return (
    <motion.div
      // ... 现有属性
      className={cn(
        "flex flex-col overflow-hidden transition-colors border shadow-xl select-none",
        "bg-[var(--color-bg)] border-[var(--color-border)]",
        settings.globalBlur ? "backdrop-blur-2xl" : "backdrop-blur-none",
        isDragging && "shadow-2xl opacity-90 ring-1 ring-black/10 dark:ring-white/10"
      )}
    >
      // ... 现有内容
    </motion.div>
  )
}
```

### 4. 设置页面UI

**外观标签页内容：**
- 主题切换：浅色/深色/跟随系统三个按钮
- 主题色选择器（现有功能）
- 选中图标背景色：白色半透明/黑色半透明两个按钮
- 选中图标毛玻璃效果：开关
- 全局毛玻璃效果：开关

### 5. 系统主题监听

**实现方式：**
1. 监听系统主题变化
2. 当设置为"跟随系统"时自动切换主题
3. 在应用启动时应用正确的主题

**系统主题监听逻辑：**
```typescript
// 在settingsStore.ts中
const initThemeListener = () => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  
  const handleChange = (e: MediaQueryListEvent) => {
    const settings = get().settings
    if (settings.theme === 'system') {
      applyTheme('system')
    }
  }
  
  mediaQuery.addEventListener('change', handleChange)
  return () => mediaQuery.removeEventListener('change', handleChange)
}
```

## 实现步骤

1. **更新类型定义** - 在`types/settings.ts`中添加新的配置项
2. **扩展CSS变量** - 在`globals.css`中添加深色主题和配置相关的CSS变量
3. **更新settingsStore** - 添加主题切换逻辑和系统主题监听
4. **更新FileItem组件** - 应用选中图标背景色和毛玻璃效果
5. **更新Container组件** - 应用全局毛玻璃效果
6. **更新SettingsPage** - 添加主题切换和配置选项UI
7. **测试功能** - 验证所有配置选项正常工作

## 文件修改清单

1. `src/types/settings.ts` - 添加新的配置项类型
2. `src/styles/globals.css` - 扩展CSS变量定义
3. `src/stores/settingsStore.ts` - 添加主题切换逻辑
4. `src/components/Item/FileItem.tsx` - 应用选中图标样式
5. `src/components/Container/Container.tsx` - 应用全局毛玻璃效果
6. `src/components/Settings/SettingsPage.tsx` - 添加配置选项UI

## 验证标准

1. 主题切换功能正常工作
2. 深色模式下选中图标背景色正确显示
3. 毛玻璃效果配置生效
4. 系统主题跟随功能正常
5. 设置页面UI响应正确
6. 所有配置选项能够正确保存和加载