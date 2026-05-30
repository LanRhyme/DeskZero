import { useContainerStore } from '@/stores/containerStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { Container as ContainerType } from '@/types/container'
import { Slider } from '@/components/UI/Slider'
import { NumberInput } from '@/components/UI/NumberInput'

interface GameContainerSettingsProps {
  container: ContainerType
  onClose: () => void
}

export function GameContainerSettings({ container, onClose }: GameContainerSettingsProps) {
  const { updateContainerStyle, updateContainerSize } = useContainerStore()
  const { settings } = useSettingsStore()

  const gw = settings.gridWidth || 80
  const gh = settings.gridHeight || 104
  const gx = settings.gridGapX ?? 20
  const gy = settings.gridGapY ?? 20

  // Calculate current grid size
  const gridW = Math.max(1, Math.round(container.size.width / (gw + gx)))
  const gridH = Math.max(1, Math.round(container.size.height / (gh + gy)))

  const updateSize = (w: number, h: number) => {
    updateContainerSize(container.id, {
      width: w * (gw + gx) - gx,
      height: h * (gh + gy) - gy
    })
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-[var(--color-text-secondary)] font-bold">网格大小 (宽 x 高)</label>
        <div className="flex gap-2 items-center">
          <NumberInput 
            value={gridW} 
            onChange={val => updateSize(val, gridH)}
            min={1}
            className="flex-1"
          />
          <span className="text-[var(--color-text)] text-xs font-medium opacity-50">x</span>
          <NumberInput 
            value={gridH} 
            onChange={val => updateSize(gridW, val)}
            min={1}
            className="flex-1"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[11px] text-[var(--color-text-secondary)] font-bold">透明度 ({Math.round((container.style.backgroundOpacity ?? 1) * 100)}%)</label>
        <Slider 
          min={0} max={1} step={0.1} 
          value={container.style.backgroundOpacity ?? 1} 
          onChange={val => updateContainerStyle(container.id, { backgroundOpacity: val })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[11px] text-[var(--color-text-secondary)] font-bold">圆角 ({container.style.cornerRadius ?? 16}px)</label>
        <Slider 
          min={0} max={40} step={1} 
          value={container.style.cornerRadius ?? 16} 
          onChange={val => updateContainerStyle(container.id, { cornerRadius: val })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-[var(--color-text-secondary)] font-bold">封面图片 (URL/路径)</label>
        <input 
          type="text" 
          placeholder="可输入自定义图片链接或本地路径"
          value={container.style.coverImage || ''}
          onChange={e => updateContainerStyle(container.id, { coverImage: e.target.value })}
          className="w-full px-2 py-1 text-xs bg-black/5 dark:bg-white/5 text-[var(--color-text)] rounded border border-transparent focus:border-blue-500 outline-none"
        />
        <span className="text-[10px] text-[var(--color-text-secondary)]">自动获取失败时可手动设置，支持本地图片路径或网络链接。</span>
      </div>

      <div className="flex justify-end pt-1">
        <button 
          onClick={onClose}
          className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          完成
        </button>
      </div>
    </div>
  )
}
