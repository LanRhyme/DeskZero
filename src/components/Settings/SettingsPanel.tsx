import { useSettingsStore } from '@/stores/settingsStore'
import type { Theme, IconSize, ItemBackground } from '@/types/settings'

interface Props {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: Props) {
  const { settings, saveSettings } = useSettingsStore()

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onClick={onClose}
    >
      <div
        className="w-96 max-h-[80vh] overflow-y-auto rounded-xl p-6"
        style={{
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          backdropFilter: 'var(--container-blur)',
          color: 'var(--color-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">设置</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">主题</label>
            <select
              className="w-full rounded-md px-3 py-2 text-sm"
              style={{
                background: 'var(--color-bg-hover)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
              value={settings.theme}
              onChange={(e) => saveSettings({ theme: e.target.value as Theme })}
            >
              <option value="light">浅色</option>
              <option value="dark">深色</option>
              <option value="system">跟随系统</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">图标大小</label>
            <select
              className="w-full rounded-md px-3 py-2 text-sm"
              style={{
                background: 'var(--color-bg-hover)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
              value={settings.iconSize}
              onChange={(e) => saveSettings({ iconSize: e.target.value as IconSize })}
            >
              <option value="small">小</option>
              <option value="medium">中</option>
              <option value="large">大</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Item 背景</label>
            <select
              className="w-full rounded-md px-3 py-2 text-sm"
              style={{
                background: 'var(--color-bg-hover)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
              value={settings.itemBackground}
              onChange={(e) => saveSettings({ itemBackground: e.target.value as ItemBackground })}
            >
              <option value="transparent">透明</option>
              <option value="subtle">浅色</option>
              <option value="visible">可见</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">网格对齐</label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.gridEnabled}
                onChange={(e) => saveSettings({ gridEnabled: e.target.checked })}
              />
              <span className="text-sm">启用</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">网格宽度</label>
            <input
              type="range"
              min="40"
              max="160"
              step="10"
              value={settings.gridWidth}
              onChange={(e) => saveSettings({ gridWidth: Number(e.target.value) })}
              className="w-full"
            />
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {settings.gridWidth}px
            </span>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">网格高度</label>
            <input
              type="range"
              min="40"
              max="160"
              step="10"
              value={settings.gridHeight}
              onChange={(e) => saveSettings({ gridHeight: Number(e.target.value) })}
              className="w-full"
            />
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {settings.gridHeight}px
            </span>
          </div>
        </div>

        <button
          className="mt-6 w-full rounded-md py-2 text-sm font-medium"
          style={{
            background: 'var(--color-accent)',
            color: 'white',
          }}
          onClick={onClose}
        >
          关闭
        </button>
      </div>
    </div>
  )
}
