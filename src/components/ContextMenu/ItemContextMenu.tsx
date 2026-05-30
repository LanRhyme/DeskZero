import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import { ChevronRight, Copy, Scissors, Trash2, Type } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDesktopStore } from '@/stores/desktopStore'
import { invoke } from '@tauri-apps/api/core'
import { Icon } from '@iconify/react'

export interface ItemContextMenuProps {
  x: number
  y: number
  paths: string[]
  onClose: () => void
  onRename?: () => void
}

export function ItemContextMenu({ x, y, paths, onClose, onRename }: ItemContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [activeSubMenu, setActiveSubMenu] = useState<number | null>(null)
  const { settings } = useSettingsStore()
  const { wallpaper, fetchDesktopItems } = useDesktopStore()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  let adjustedX = x
  let adjustedY = y
  if (menuRef.current) {
    const rect = menuRef.current.getBoundingClientRect()
    if (x + rect.width > window.innerWidth) adjustedX = window.innerWidth - rect.width
    if (y + rect.height > window.innerHeight) adjustedY = window.innerHeight - rect.height
  }

  const handleCopy = async () => {
    try {
      await invoke('copy_files_to_clipboard', { paths })
      onClose()
    } catch (e) {
      console.error(e)
    }
  }

  const handleCut = async () => {
    // Currently no cut_files_to_clipboard. Fallback to copy.
    try {
      await invoke('copy_files_to_clipboard', { paths })
      onClose()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async () => {
    try {
      await Promise.all(paths.map(p => invoke('trash_file', { path: p })))
      fetchDesktopItems()
      onClose()
    } catch (e) {
      console.error(e)
    }
  }

  const handleRename = () => {
    if (onRename) {
      onRename()
    }
    onClose()
  }

  const menuItems = [
    { label: '打开', icon: <Icon icon="iconamoon:enter" />, onClick: () => {
      paths.forEach(p => invoke('open_file', { path: p }))
    }},
    { label: '以管理员身份运行', icon: <Icon icon="iconamoon:shield-yes" />, onClick: () => {
      paths.forEach(p => invoke('run_as_admin', { path: p }))
    }},
    { label: '打开方式', icon: <Icon icon="iconamoon:terminal" />, subItems: [
      { label: '打开文件所在位置', icon: <Icon icon="iconamoon:folder" />, onClick: () => {
        paths.forEach(p => invoke('open_file_location', { path: p }))
      }},
      { label: '以记事本打开', icon: <Icon icon="iconamoon:file-document" />, onClick: () => {
        paths.forEach(p => invoke('open_with_notepad', { path: p }))
      }},
      { label: '以 cmd 打开', icon: <Icon icon="iconamoon:terminal" />, onClick: () => {
        if (paths.length > 0) {
           const dir = paths[0].substring(0, paths[0].lastIndexOf('\\')) || paths[0]
           invoke('open_terminal', { shell: 'cmd', path: dir })
        }
      }},
      { label: '以 ps 打开', icon: <Icon icon="iconamoon:terminal" />, onClick: () => {
        if (paths.length > 0) {
           const dir = paths[0].substring(0, paths[0].lastIndexOf('\\')) || paths[0]
           invoke('open_terminal', { shell: 'powershell', path: dir })
        }
      }},
      { label: '其他打开方式', icon: <Icon icon="iconamoon:apps" />, onClick: () => {
        paths.forEach(p => invoke('show_open_with_dialog', { path: p }))
      }},
    ]},
    { label: '固定到任务栏', icon: <Icon icon="iconamoon:bookmark" />, onClick: () => {
      paths.forEach(p => invoke('pin_to_taskbar', { path: p }))
    }},
    { label: '复制位置属性', icon: <Icon icon="iconamoon:copy" />, subItems: [
      { label: `复制文件名: ${paths.map(p => p.substring(p.lastIndexOf('\\') + 1)).join(', ')}`, icon: <Icon icon="iconamoon:file" />, onClick: async () => {
        const names = paths.map(p => p.substring(p.lastIndexOf('\\') + 1))
        await navigator.clipboard.writeText(names.join('\n'))
      }},
      { label: `复制文件位置(不带引号): ${paths[0] || ''}${paths.length > 1 ? '...' : ''}`, icon: <Icon icon="iconamoon:link" />, onClick: async () => {
        await navigator.clipboard.writeText(paths.join('\n'))
      }},
      { label: `复制文件位置(带双引号): "${paths[0] || ''}"${paths.length > 1 ? '...' : ''}`, icon: <Icon icon="iconamoon:link" />, onClick: async () => {
        const quoted = paths.map(p => `"${p}"`)
        await navigator.clipboard.writeText(quoted.join('\n'))
      }},
    ]},
    { label: '创建快捷方式', icon: <Icon icon="iconamoon:link-external" />, onClick: () => {
      paths.forEach(p => invoke('create_shortcut_item', { path: p }))
      setTimeout(() => fetchDesktopItems(), 1000)
    }},
    { label: '属性', icon: <Icon icon="iconamoon:settings" />, onClick: () => {
      paths.forEach(p => invoke('show_properties_dialog', { path: p }))
    }},
  ]

  const showOnLeft = x > window.innerWidth / 2;

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className={cn(
          "fixed z-50 min-w-[200px] py-1 border shadow-2xl rounded-lg",
          settings.globalBlur === false
            ? "bg-white dark:bg-[#1a1a1a] border-black/5 dark:border-white/10"
            : settings.wallpaperCompatible && wallpaper
              ? "border-white/20 dark:border-white/10"
              : "bg-white/60 dark:bg-[#1a1a1a]/70 backdrop-blur-3xl border-white/20 dark:border-white/10"
        )}
        style={{ left: adjustedX, top: adjustedY }}
      >
        {settings.wallpaperCompatible && settings.globalBlur !== false && wallpaper && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: -1, borderRadius: 'inherit' }}>
            <div className="absolute inset-0" style={{ backgroundImage: `url(${wallpaper})`, backgroundAttachment: 'fixed', backgroundPosition: 'top left', backgroundSize: '100vw 100vh', filter: 'blur(20px)' }} />
            <div className="absolute inset-0 bg-white/60 dark:bg-[#1a1a1a]/70" />
          </div>
        )}

        {/* Top 4 Icons */}
        <div className="flex items-center justify-around px-2 py-1 mb-1">
          <button onClick={handleCopy} className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors" title="复制">
            <Copy size={16} />
          </button>
          <button onClick={handleCut} className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors" title="剪切">
            <Scissors size={16} />
          </button>
          <button onClick={handleDelete} className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors" title="删除">
            <Trash2 size={16} />
          </button>
          <button onClick={handleRename} className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors" title="重命名">
            <Type size={16} />
          </button>
        </div>
        
        <div className="h-px bg-black/5 dark:bg-white/10 mx-2 mb-1" />

        {menuItems.map((item, index) => {
          const hasSub = item.subItems && item.subItems.length > 0;
          const isActive = activeSubMenu === index;

          return (
            <div key={index} className="relative" onPointerEnter={() => setActiveSubMenu(index)}>
              <button
                onClick={() => {
                  if (!hasSub && item.onClick) {
                    item.onClick()
                    onClose()
                  }
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-1 text-xs text-left transition-colors",
                  "hover:bg-black/5 dark:hover:bg-white/10",
                  isActive && hasSub ? "bg-black/5 dark:bg-white/10" : "",
                  "cursor-default text-gray-800 dark:text-gray-200"
                )}
              >
                <div className="flex items-center gap-2">
                  {item.icon ? <span className="w-3.5 h-3.5 flex items-center justify-center text-sm">{item.icon}</span> : <span className="w-3.5 h-3.5" />}
                  {item.label}
                </div>
                {hasSub && <ChevronRight size={14} className="opacity-60" />}
              </button>

              {hasSub && isActive && (
                <div className={cn("absolute top-0 z-50", showOnLeft ? "right-[calc(100%-4px)] pr-1" : "left-[calc(100%-4px)] pl-1")}>
                  <motion.div
                    initial={{ opacity: 0, x: showOnLeft ? 5 : -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "min-w-[180px] py-1 border shadow-2xl rounded-lg",
                      settings.globalBlur === false
                        ? "bg-white dark:bg-[#1a1a1a] border-black/5 dark:border-white/10"
                        : settings.wallpaperCompatible && wallpaper
                          ? "border-white/20 dark:border-white/10"
                          : "bg-white/60 dark:bg-[#1a1a1a]/70 backdrop-blur-3xl border-white/20 dark:border-white/10"
                    )}
                  >
                    {settings.wallpaperCompatible && settings.globalBlur !== false && wallpaper && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: -1, borderRadius: 'inherit' }}>
                        <div className="absolute inset-0" style={{ backgroundImage: `url(${wallpaper})`, backgroundAttachment: 'fixed', backgroundPosition: 'top left', backgroundSize: '100vw 100vh', filter: 'blur(20px)' }} />
                        <div className="absolute inset-0 bg-white/60 dark:bg-[#1a1a1a]/70" />
                      </div>
                    )}

                    {item.subItems!.map((subItem, subIndex) => (
                      <button
                        key={subIndex}
                        onClick={() => {
                          if (subItem.onClick) {
                            subItem.onClick()
                            onClose()
                          }
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-1 text-xs text-left transition-colors",
                          "hover:bg-black/5 dark:hover:bg-white/10 text-gray-800 dark:text-gray-200"
                        )}
                      >
                        {subItem.icon ? <span className="w-3.5 h-3.5 flex items-center justify-center text-sm">{subItem.icon}</span> : <span className="w-3.5 h-3.5" />}
                        {subItem.label}
                      </button>
                    ))}
                  </motion.div>
                </div>
              )}
            </div>
          )
        })}
      </motion.div>
    </AnimatePresence>
  )
}
