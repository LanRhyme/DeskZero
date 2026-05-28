# 深浅色模式切换功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为DeskZero应用添加深浅色模式切换功能，支持浅色/深色/跟随系统三种模式，并提供选中图标背景色和毛玻璃效果的配置选项。

**Architecture:** 使用混合实现方法，CSS变量定义基础颜色，JavaScript管理特殊效果。通过`data-theme`属性切换主题，使用Zustand存储配置。

**Tech Stack:** React, TypeScript, Zustand, Tailwind CSS, CSS Variables

---

## 文件结构

在开始实现之前，了解需要创建或修改的文件及其职责：

1. **`src/types/settings.ts`** - 添加新的配置项类型定义
2. **`src/styles/globals.css`** - 扩展CSS变量定义，添加深色主题和配置相关的CSS变量
3. **`src/stores/settingsStore.ts`** - 添加主题切换逻辑和系统主题监听
4. **`src/components/Item/FileItem.tsx`** - 应用选中图标背景色和毛玻璃效果
5. **`src/components/Container/Container.tsx`** - 应用全局毛玻璃效果
6. **`src/components/Settings/SettingsPage.tsx`** - 添加主题切换和配置选项UI

---

### Task 1: 更新类型定义

**Files:**
- Modify: `src/types/settings.ts`

- [ ] **Step 1: 添加新的配置项类型**

```typescript
export type Theme = 'light' | 'dark' | 'system'
export type IconSize = 'small' | 'medium' | 'large'
export type ItemBackground = 'transparent' | 'subtle' | 'visible'
export type SelectedItemBackground = 'white' | 'black'

export interface Settings {
  theme: Theme
  accentColor: string
  gridEnabled: boolean
  gridSize: number
  iconSize: IconSize
  cornerRadius: number
  backgroundBlur: boolean
  wallpaperCompatible: boolean
  itemBackground: ItemBackground
  selectedItemBackground: SelectedItemBackground
  selectedItemBlur: boolean
  globalBlur: boolean
}
```

- [ ] **Step 2: 验证类型定义**

运行TypeScript编译器检查类型定义是否正确：
```bash
npx tsc --noEmit
```

Expected: 没有类型错误

- [ ] **Step 3: 提交更改**

```bash
git add src/types/settings.ts
git commit -m "feat: add theme switching type definitions"
```

---

### Task 2: 扩展CSS变量定义

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: 添加深色主题CSS变量**

```css
@import "tailwindcss";

body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  user-select: none;
  font-family: system-ui, -apple-system, sans-serif;
}

:root {
  /* 浅色主题（默认） */
  --color-bg: rgba(243, 243, 243, 0.88);
  --color-bg-hover: rgba(249, 249, 249, 0.92);
  --color-text: #1a1a1a;
  --color-text-secondary: #6b6b6b;
  --color-border: rgba(0, 0, 0, 0.06);
  --color-accent: #0078d4;
  --color-accent-subtle: rgba(0, 120, 212, 0.1);
  --container-radius: 10px;
  --container-blur: blur(30px);
  --item-bg: transparent;
  --item-bg-hover: rgba(0, 0, 0, 0.04);
  --item-radius: 6px;
  --icon-size: 48px;
  
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
  --item-bg-hover: rgba(255, 255, 255, 0.06);
  
  /* 深色主题下的选中图标背景色 */
  --item-selected-bg: rgba(0, 0, 0, 0.3);
  --item-selected-ring: rgba(0, 0, 0, 0.5);
}

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

- [ ] **Step 2: 验证CSS变量**

在浏览器中打开应用，检查CSS变量是否正确应用。

- [ ] **Step 3: 提交更改**

```bash
git add src/styles/globals.css
git commit -m "feat: add dark theme CSS variables"
```

---

### Task 3: 更新settingsStore

**Files:**
- Modify: `src/stores/settingsStore.ts`

- [ ] **Step 1: 添加主题切换逻辑**

```typescript
import { create } from 'zustand'
import type { Settings, Theme } from '@/types/settings'
import { invoke } from '@tauri-apps/api/core'

interface SettingsState {
  settings: Settings
  loading: boolean
  loadSettings: () => Promise<void>
  saveSettings: (settings: Partial<Settings>) => Promise<void>
  applyTheme: (theme: Theme) => void
  initThemeListener: () => () => void
}

const defaultSettings: Settings = {
  theme: 'system',
  accentColor: '#0078d4',
  gridEnabled: true,
  gridSize: 80,
  iconSize: 'medium',
  cornerRadius: 10,
  backgroundBlur: true,
  wallpaperCompatible: true,
  itemBackground: 'transparent',
  selectedItemBackground: 'white',
  selectedItemBlur: false,
  globalBlur: true,
}

const applyTheme = (theme: Theme) => {
  const root = document.documentElement
  if (theme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    root.setAttribute('data-theme', systemTheme)
  } else {
    root.setAttribute('data-theme', theme)
  }
}

const applySelectedBackground = (background: 'white' | 'black') => {
  document.documentElement.setAttribute('data-selected-bg', background)
}

const applyGlobalBlur = (enabled: boolean) => {
  document.documentElement.setAttribute('data-global-blur', String(enabled))
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loading: false,

  loadSettings: async () => {
    set({ loading: true })
    try {
      const settings = await invoke<Settings>('get_settings')
      set({ settings, loading: false })
      applyTheme(settings.theme)
      applySelectedBackground(settings.selectedItemBackground)
      applyGlobalBlur(settings.globalBlur)
    } catch {
      set({ loading: false })
    }
  },

  saveSettings: async (changes) => {
    const newSettings = { ...get().settings, ...changes }
    set({ settings: newSettings })
    try {
      await invoke('save_settings', { settings: newSettings })
      
      if (changes.theme) {
        applyTheme(newSettings.theme)
      }
      if (changes.selectedItemBackground) {
        applySelectedBackground(newSettings.selectedItemBackground)
      }
      if (changes.globalBlur !== undefined) {
        applyGlobalBlur(newSettings.globalBlur)
      }
    } catch (err) {
      console.error('保存设置失败:', err)
    }
  },

  applyTheme: (theme: Theme) => {
    applyTheme(theme)
  },

  initThemeListener: () => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = () => {
      const settings = get().settings
      if (settings.theme === 'system') {
        applyTheme('system')
      }
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }
}))
```

- [ ] **Step 2: 验证settingsStore**

运行TypeScript编译器检查类型定义是否正确：
```bash
npx tsc --noEmit
```

Expected: 没有类型错误

- [ ] **Step 3: 提交更改**

```bash
git add src/stores/settingsStore.ts
git commit -m "feat: add theme switching logic to settingsStore"
```

---

### Task 4: 更新FileItem组件

**Files:**
- Modify: `src/components/Item/FileItem.tsx`

- [ ] **Step 1: 应用选中图标背景色和毛玻璃效果**

```typescript
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import type { Item } from '@/types/item'
import { File, Folder, Link } from 'lucide-react'
import { useDesktopStore } from '@/stores/desktopStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { invoke } from '@tauri-apps/api/core'
import { useDrag } from '@/hooks/useDrag'

interface FileItemProps {
  item: Item & { position?: { x: number, y: number } }
  className?: string
  onClick?: (e: React.MouseEvent) => void
  onDoubleClick?: (e: React.MouseEvent) => void
  onContextMenu?: (e: React.MouseEvent) => void
}

export function FileItem({ item, className, onClick, onDoubleClick, onContextMenu }: FileItemProps) {
  const { selectedIds, toggleSelection, setSelection, moveSelectedItems } = useDesktopStore()
  const { settings } = useSettingsStore()
  const isSelected = selectedIds.has(item.id)
  
  const initialPos = item.position || { x: 0, y: 0 }

  let iconPath = item.iconPath || ''
  if (iconPath.startsWith('http')) {
    iconPath = ''
  }
  iconPath = iconPath.replace(/^file:\/\/\//, '')
  
  let currentSelectedIds = selectedIds
  if (!isSelected) {
    currentSelectedIds = new Set([item.id])
  }
  
  const paths = Array.from(currentSelectedIds)
    .map(id => useDesktopStore.getState().items.find(i => i.id === id)?.path)
    .filter(Boolean) as string[]
    
  if (paths.length === 0) paths.push(item.path)

  const normalizedPaths = paths.map(p => p.replace(/\//g, '\\'))
  const normalizedIcon = iconPath.replace(/\//g, '\\')

  const { ref, pos, isDragging, listeners } = useDrag(initialPos, {
    disabled: item.isInContainer,
    nativeDragItemPaths: normalizedPaths,
    nativeDragIconPath: normalizedIcon,
    onDragStart: () => {
      if (!isSelected) {
        setSelection([item.id])
      }
    },
    onDragEnd: (newPos) => {
      if (!item.isInContainer) {
        moveSelectedItems(item.id, newPos.x, newPos.y)
      }
    }
  })

  const renderIcon = () => {
    if (item.iconPath && item.iconPath.startsWith('data:image/')) {
      return <img src={item.iconPath} alt={item.name} className="w-10 h-10 object-contain pointer-events-none drop-shadow-md" />
    }
    const iconProps = { className: "w-10 h-10 text-white/80 pointer-events-none drop-shadow-md" }
    switch (item.type) {
      case 'folder': return <Folder {...iconProps} fill="currentColor" className="w-10 h-10 text-yellow-400 pointer-events-none drop-shadow-md" />
      case 'shortcut': return <Link {...iconProps} />
      case 'url': return <Link {...iconProps} />
      default: return <File {...iconProps} />
    }
  }

  const layoutStyle = item.isInContainer ? {} : {
    position: 'absolute' as const,
    zIndex: isDragging ? 50 : (isSelected ? 20 : 'auto'),
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onClick) {
      onClick(e)
    } else {
      toggleSelection(item.id, e.ctrlKey || e.metaKey)
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDoubleClick) {
      onDoubleClick(e)
    } else {
      invoke('open_file', { path: item.path })
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    
    // Select the item if it's not already selected
    if (!isSelected) {
      setSelection([item.id])
    }
    
    if (onContextMenu) {
      onContextMenu(e)
    } else {
      // Get all selected item paths
      const currentPaths = isSelected ? paths : [item.path]
      const currentNormalized = currentPaths.map(p => p.replace(/\//g, '\\'))
      invoke('show_context_menu', { paths: currentNormalized, x: e.screenX, y: e.screenY })
    }
  }

  return (
    <motion.div
      ref={ref}
      style={layoutStyle}
      animate={item.isInContainer ? {} : { left: pos.x, top: pos.y }}
      transition={isDragging ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
      {...listeners}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      className={cn(
        "flex flex-col items-center justify-start p-2 rounded-md w-20 h-24 select-none touch-none",
        isDragging ? "opacity-50 cursor-grabbing" : "cursor-default hover:bg-white/10",
        isSelected && "bg-[var(--item-selected-bg)] ring-1 ring-[var(--item-selected-ring)]",
        isSelected && settings.selectedItemBlur && "selected-blur",
        className
      )}
    >
      <div className="w-12 h-12 flex items-center justify-center mb-1 relative pointer-events-none">
        {renderIcon()}
        {item.type === 'shortcut' && (
          <div className="absolute -bottom-1 -left-1 bg-white rounded-sm p-0.5 shadow-sm">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-black">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </div>
        )}
      </div>
      <span 
        className={cn(
          "text-xs text-center break-words w-full line-clamp-2 drop-shadow-md pointer-events-none text-white",
          isSelected && ""
        )}
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
      >
        {item.name}
      </span>
    </motion.div>
  )
}
```

- [ ] **Step 2: 验证FileItem组件**

运行TypeScript编译器检查类型定义是否正确：
```bash
npx tsc --noEmit
```

Expected: 没有类型错误

- [ ] **Step 3: 提交更改**

```bash
git add src/components/Item/FileItem.tsx
git commit -m "feat: apply selected item background and blur effects"
```

---

### Task 5: 更新Container组件

**Files:**
- Modify: `src/components/Container/Container.tsx`

- [ ] **Step 1: 应用全局毛玻璃效果**

```typescript
import { useRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import type { Container as ContainerType } from '@/types/container'
import { FileItem } from '../Item/FileItem'
import { Settings } from 'lucide-react'
import { useDrag } from '@/hooks/useDrag'
import { useContainerStore } from '@/stores/containerStore'
import { useSettingsStore } from '@/stores/settingsStore'

interface ContainerProps {
  container: ContainerType
}

export function Container({ container }: ContainerProps) {
  const { updateContainerPosition } = useContainerStore()
  const { settings } = useSettingsStore()
  const dragHandleRef = useRef<HTMLDivElement>(null)

  const { ref, pos, isDragging, listeners } = useDrag(container.position, {
    dragHandleRef,
    onDragEnd: (newPos) => {
      // Optional snap to grid for containers
      const snapX = Math.round(newPos.x / 40) * 40
      const snapY = Math.round(newPos.y / 40) * 40
      updateContainerPosition(container.id, { x: snapX, y: snapY })
    }
  })

  return (
    <motion.div
      ref={ref}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: container.size.width,
        height: container.size.height,
        borderRadius: container.style.cornerRadius || 10,
        zIndex: isDragging ? 40 : 10,
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex flex-col overflow-hidden transition-colors border shadow-xl select-none",
        "bg-[var(--color-bg)] border-[var(--color-border)]",
        settings.globalBlur ? "backdrop-blur-2xl" : "backdrop-blur-none",
        isDragging && "shadow-2xl opacity-90 ring-1 ring-black/10 dark:ring-white/10"
      )}
    >
      {/* Header (Draggable Area) */}
      <div 
        ref={dragHandleRef}
        {...listeners}
        className="flex items-center justify-between px-3 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-move touch-none"
      >
        <span className="text-sm font-medium text-[var(--color-text)] pointer-events-none">
          {container.name}
        </span>
        <div className="flex gap-2">
          <button 
            onPointerDown={(e) => e.stopPropagation()} // Prevent dragging when clicking settings
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-[var(--color-text-secondary)] transition-colors cursor-pointer"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-2 flex flex-wrap content-start gap-1 overflow-y-auto">
        {container.items.map(item => (
          <FileItem key={item.id} item={item} />
        ))}
        {container.items.length === 0 && (
          <div className="w-full h-full flex items-center justify-center text-sm text-[var(--color-text-secondary)] opacity-50 pointer-events-none">
            Drag items here
          </div>
        )}
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 2: 验证Container组件**

运行TypeScript编译器检查类型定义是否正确：
```bash
npx tsc --noEmit
```

Expected: 没有类型错误

- [ ] **Step 3: 提交更改**

```bash
git add src/components/Container/Container.tsx
git commit -m "feat: apply global blur effect to container"
```

---

### Task 6: 更新SettingsPage

**Files:**
- Modify: `src/components/Settings/SettingsPage.tsx`

- [ ] **Step 1: 添加主题切换和配置选项UI**

```typescript
import { useState } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general')
  const { settings, saveSettings } = useSettingsStore()

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100 select-none overflow-hidden">

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 p-4 border-r border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex flex-col gap-2">
          <button 
            onClick={() => setActiveTab('general')}
            className={`px-3 py-2 rounded-md text-left text-sm transition-colors ${activeTab === 'general' ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}
          >
            通用
          </button>
          <button 
            onClick={() => setActiveTab('appearance')}
            className={`px-3 py-2 rounded-md text-left text-sm transition-colors ${activeTab === 'appearance' ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}
          >
            外观
          </button>
          <button 
            onClick={() => setActiveTab('about')}
            className={`px-3 py-2 rounded-md text-left text-sm transition-colors ${activeTab === 'about' ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}
          >
            关于
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'general' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-xl font-bold mb-6">通用设置</h2>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">开机启动</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">登录 Windows 时自动运行 DeskZero</div>
                  </div>
                  <div className="w-10 h-5 bg-black/20 dark:bg-white/20 rounded-full relative cursor-pointer">
                    <div className="w-4 h-4 bg-white rounded-full absolute left-0.5 top-0.5 shadow-sm"></div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">双击隐藏桌面图标</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">在桌面空白处双击可快速隐藏或显示所有图标</div>
                  </div>
                  <div className="w-10 h-5 bg-blue-500 rounded-full relative cursor-pointer">
                    <div className="w-4 h-4 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-xl font-bold mb-6">外观</h2>
              <div className="space-y-6">
                {/* 主题切换 */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">主题</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">选择应用的主题外观</div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => saveSettings({ theme: 'light' })}
                      className={`px-3 py-1 rounded-md text-sm ${settings.theme === 'light' ? 'bg-blue-500 text-white' : 'bg-black/10 dark:bg-white/10'}`}
                    >
                      浅色
                    </button>
                    <button 
                      onClick={() => saveSettings({ theme: 'dark' })}
                      className={`px-3 py-1 rounded-md text-sm ${settings.theme === 'dark' ? 'bg-blue-500 text-white' : 'bg-black/10 dark:bg-white/10'}`}
                    >
                      深色
                    </button>
                    <button 
                      onClick={() => saveSettings({ theme: 'system' })}
                      className={`px-3 py-1 rounded-md text-sm ${settings.theme === 'system' ? 'bg-blue-500 text-white' : 'bg-black/10 dark:bg-white/10'}`}
                    >
                      跟随系统
                    </button>
                  </div>
                </div>

                {/* 主题色 */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">主题色</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">设置高亮和焦点控件的颜色</div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500 ring-2 ring-offset-1 ring-blue-500 dark:ring-offset-black cursor-pointer"></div>
                    <div className="w-6 h-6 rounded-full bg-purple-500 cursor-pointer"></div>
                    <div className="w-6 h-6 rounded-full bg-emerald-500 cursor-pointer"></div>
                    <div className="w-6 h-6 rounded-full bg-rose-500 cursor-pointer"></div>
                  </div>
                </div>

                {/* 选中图标背景色 */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">选中图标背景色</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">设置选中图标时的背景颜色</div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => saveSettings({ selectedItemBackground: 'white' })}
                      className={`px-3 py-1 rounded-md text-sm ${settings.selectedItemBackground === 'white' ? 'bg-blue-500 text-white' : 'bg-black/10 dark:bg-white/10'}`}
                    >
                      白色半透明
                    </button>
                    <button 
                      onClick={() => saveSettings({ selectedItemBackground: 'black' })}
                      className={`px-3 py-1 rounded-md text-sm ${settings.selectedItemBackground === 'black' ? 'bg-blue-500 text-white' : 'bg-black/10 dark:bg-white/10'}`}
                    >
                      黑色半透明
                    </button>
                  </div>
                </div>

                {/* 选中图标毛玻璃效果 */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">选中图标毛玻璃效果</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">为选中的图标背景添加毛玻璃效果</div>
                  </div>
                  <div 
                    onClick={() => saveSettings({ selectedItemBlur: !settings.selectedItemBlur })}
                    className={`w-10 h-5 rounded-full relative cursor-pointer ${settings.selectedItemBlur ? 'bg-blue-500' : 'bg-black/20 dark:bg-white/20'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm ${settings.selectedItemBlur ? 'right-0.5' : 'left-0.5'}`}></div>
                  </div>
                </div>

                {/* 全局毛玻璃效果 */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">全局毛玻璃效果</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">为容器和界面元素添加毛玻璃效果</div>
                  </div>
                  <div 
                    onClick={() => saveSettings({ globalBlur: !settings.globalBlur })}
                    className={`w-10 h-5 rounded-full relative cursor-pointer ${settings.globalBlur ? 'bg-blue-500' : 'bg-black/20 dark:bg-white/20'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm ${settings.globalBlur ? 'right-0.5' : 'left-0.5'}`}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-600 shadow-xl flex items-center justify-center text-white text-3xl font-bold">
                DZ
              </div>
              <div>
                <h2 className="text-2xl font-bold">DeskZero</h2>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">版本 0.1.0</div>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mt-4">
                一款现代化的 Windows 桌面整理工具，为您提供毛玻璃质感、丝滑的拖拽动画与高效的收纳体验。
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证SettingsPage组件**

运行TypeScript编译器检查类型定义是否正确：
```bash
npx tsc --noEmit
```

Expected: 没有类型错误

- [ ] **Step 3: 提交更改**

```bash
git add src/components/Settings/SettingsPage.tsx
git commit -m "feat: add theme switching UI to settings page"
```

---

### Task 7: 更新App组件

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 初始化主题监听**

```typescript
import { useEffect } from 'react'
import DesktopLayer from '@/components/Desktop/DesktopLayer'
import { SettingsPage } from '@/components/Settings/SettingsPage'
import { useSettingsStore } from '@/stores/settingsStore'

function App() {
  const isSettings = window.location.pathname === '/settings'
  const { loadSettings, initThemeListener } = useSettingsStore()

  useEffect(() => {
    loadSettings()
    const cleanup = initThemeListener()
    return cleanup
  }, [loadSettings, initThemeListener])

  if (isSettings) {
    return <SettingsPage />
  }

  return <DesktopLayer />
}

export default App
```

- [ ] **Step 2: 验证App组件**

运行TypeScript编译器检查类型定义是否正确：
```bash
npx tsc --noEmit
```

Expected: 没有类型错误

- [ ] **Step 3: 提交更改**

```bash
git add src/App.tsx
git commit -m "feat: initialize theme listener in App component"
```

---

### Task 8: 测试功能

**Files:**
- Test: 整个应用

- [ ] **Step 1: 测试主题切换**

1. 启动应用
2. 打开设置页面
3. 切换到外观标签页
4. 测试浅色/深色/跟随系统三种主题
5. 验证主题切换是否正常工作

- [ ] **Step 2: 测试选中图标背景色**

1. 在设置页面中切换选中图标背景色（白色半透明/黑色半透明）
2. 在桌面上选中一个图标
3. 验证选中图标背景色是否正确应用

- [ ] **Step 3: 测试毛玻璃效果**

1. 在设置页面中切换选中图标毛玻璃效果
2. 在桌面上选中一个图标
3. 验证毛玻璃效果是否正确应用

4. 在设置页面中切换全局毛玻璃效果
5. 验证容器的毛玻璃效果是否正确应用

- [ ] **Step 4: 测试系统主题跟随**

1. 将主题设置为"跟随系统"
2. 更改操作系统主题
3. 验证应用主题是否自动切换

- [ ] **Step 5: 提交最终更改**

```bash
git add .
git commit -m "feat: complete theme switching feature"
```

---

## 自我审查

**1. 规范覆盖：** 检查设计文档中的每个部分/需求。可以指出实现它的任务吗？

- ✅ 主题切换机制 - Task 3
- ✅ 选中图标背景色配置 - Task 4
- ✅ 全局毛玻璃效果配置 - Task 5
- ✅ 设置页面UI - Task 6
- ✅ 系统主题监听 - Task 7

**2. 占位符扫描：** 搜索计划中的红旗

- ✅ 没有"TBD"、"TODO"、"implement later"、"fill in details"
- ✅ 没有"Add appropriate error handling" / "add validation" / "handle edge cases"
- ✅ 没有"Write tests for the above"（没有实际测试代码）
- ✅ 没有"Similar to Task N"（重复代码）

**3. 类型一致性：** 检查类型、方法签名和属性名称是否一致

- ✅ `selectedItemBackground` 在所有地方都一致
- ✅ `selectedItemBlur` 在所有地方都一致
- ✅ `globalBlur` 在所有地方都一致
- ✅ `applyTheme` 在所有地方都一致

---

## 执行选项

**计划完成并保存到 `docs/superpowers/plans/2026-05-28-theme-switching-implementation.md`。两种执行选项：**

**1. Subagent-Driven（推荐）** - 我为每个任务调度一个新的子代理，任务之间进行审查，快速迭代

**2. Inline Execution** - 在本会话中使用executing-plans执行任务，批量执行并设置检查点

**选择哪种方法？**