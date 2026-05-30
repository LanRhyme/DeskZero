import { useState } from 'react'
import type { Container } from '@/types/container'
import { useContainerStore } from '@/stores/containerStore'
import { X, LayoutGrid, List } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

interface ContainerSettingsProps {
  container: Container
  onClose: () => void
}

export function ContainerSettings({ container, onClose }: ContainerSettingsProps) {
  const { updateContainerStyle, updateContainerName, deleteContainer } = useContainerStore()
  
  const [name, setName] = useState(container.name)
  const [opacity, setOpacity] = useState(container.style.backgroundOpacity ?? 0.3)
  const [bgColor, setBgColor] = useState(container.style.backgroundColor || '#000000')
  const [layout, setLayout] = useState(container.style.layout || 'grid')
  const [gridWidth, setGridWidth] = useState(container.style.gridWidth ?? 80)
  const [gridHeight, setGridHeight] = useState(container.style.gridHeight ?? 104)
  const [showDetails, setShowDetails] = useState(container.style.showDetails ?? false)

  const handleSave = () => {
    if (name.trim() && name !== container.name) {
      updateContainerName(container.id, name.trim())
    }
    updateContainerStyle(container.id, {
      backgroundOpacity: opacity,
      backgroundColor: bgColor,
      layout: layout as 'grid' | 'list',
      gridWidth,
      gridHeight,
      showDetails,
    })
    onClose()
  }

  const handleDelete = () => {
    deleteContainer(container.id)
    onClose()
  }

  return (
    <div className="w-full transform overflow-hidden rounded-xl bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-3xl p-4 text-left align-middle shadow-2xl transition-all border border-black/5 dark:border-white/10 ring-1 ring-black/5">
      <div className="text-base font-medium leading-6 text-[var(--color-text)] flex justify-between items-center mb-4">
        <span>收纳盒设置 <span className="text-xs font-normal text-[var(--color-text-secondary)] opacity-70">({container.name})</span></span>
        <button 
          onClick={onClose}
          className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-[var(--color-text-secondary)]"
        >
          <X size={14} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">收纳盒名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow"
            placeholder="输入收纳盒名称..."
          />
        </div>

        {/* Colors */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">背景设计</label>
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 rounded-full overflow-hidden shadow-inner ring-1 ring-black/10 dark:ring-white/10 cursor-pointer group">
              <input 
                type="color" 
                value={bgColor.startsWith('#') ? bgColor : '#000000'}
                onChange={(e) => setBgColor(e.target.value)}
                className="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer"
              />
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mb-1.5">
                <span>透明度</span>
                <span>{Math.round(opacity * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full h-1 bg-black/10 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="h-[1px] w-full bg-black/5 dark:bg-white/10 my-1" />

        {/* Layout */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">排版方式</label>
          <div className="flex gap-1.5">
            <button 
              onClick={() => setLayout('grid')}
              className={cn(
                "flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium transition-all duration-200",
                layout === 'grid' 
                  ? "bg-blue-500 text-white shadow-sm shadow-blue-500/20" 
                  : "bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)] hover:bg-black/10 dark:hover:bg-white/10"
              )}
            >
              <LayoutGrid size={14} />
              网格
            </button>
            <button 
              onClick={() => setLayout('list')}
              className={cn(
                "flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium transition-all duration-200",
                layout === 'list' 
                  ? "bg-blue-500 text-white shadow-sm shadow-blue-500/20" 
                  : "bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)] hover:bg-black/10 dark:hover:bg-white/10"
              )}
            >
              <List size={14} />
              列表
            </button>
          </div>
        </div>

        {/* Grid Size Config */}
        <motion.div 
          initial={false}
          animate={{ height: layout === 'grid' ? 'auto' : 0, opacity: layout === 'grid' ? 1 : 0 }}
          className="overflow-hidden"
        >
          <div className="space-y-2 pt-2">
            <label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">网格尺寸</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <input 
                  type="number" 
                  value={gridWidth}
                  onChange={(e) => setGridWidth(parseInt(e.target.value) || 0)}
                  className="w-full bg-black/5 dark:bg-white/5 text-[var(--color-text)] rounded-lg py-1.5 px-2 pl-7 text-xs border border-transparent focus:border-blue-500/50 focus:bg-transparent outline-none transition-all"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] text-[10px] font-medium">W</span>
              </div>
              <div className="relative">
                <input 
                  type="number" 
                  value={gridHeight}
                  onChange={(e) => setGridHeight(parseInt(e.target.value) || 0)}
                  className="w-full bg-black/5 dark:bg-white/5 text-[var(--color-text)] rounded-lg py-1.5 px-2 pl-7 text-xs border border-transparent focus:border-blue-500/50 focus:bg-transparent outline-none transition-all"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] text-[10px] font-medium">H</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* List Size Config */}
        <motion.div 
          initial={false}
          animate={{ height: layout === 'list' ? 'auto' : 0, opacity: layout === 'list' ? 1 : 0 }}
          className="overflow-hidden"
        >
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--color-text)] opacity-90 block">列表项高度</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={gridHeight}
                  onChange={(e) => setGridHeight(parseInt(e.target.value) || 0)}
                  className="w-full bg-black/5 dark:bg-white/5 text-[var(--color-text)] rounded-lg py-1.5 px-2 pl-7 text-xs border border-transparent focus:border-blue-500/50 focus:bg-transparent outline-none transition-all"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] text-[10px] font-medium">H</span>
              </div>
            </div>
            
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative flex items-center">
                <input 
                  type="checkbox" 
                  checked={showDetails}
                  onChange={(e) => setShowDetails(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-8 h-4.5 bg-black/10 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[14px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-500 transition-colors"></div>
              </div>
              <span className="text-xs font-medium text-[var(--color-text)] group-hover:text-blue-500 transition-colors">显示详细信息</span>
            </label>
          </div>
        </motion.div>

        <div className="pt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 justify-center rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/20 transition-colors focus:outline-none"
            onClick={handleDelete}
          >
            移除
          </button>
          <button
            type="button"
            className="flex-1 justify-center rounded-lg border border-transparent bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors focus:outline-none"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="flex-1 justify-center rounded-lg border border-transparent bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 transition-colors shadow-md shadow-blue-500/25 focus:outline-none"
            onClick={handleSave}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
