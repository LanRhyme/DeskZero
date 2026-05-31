import { useSettingsStore } from '@/stores/settingsStore'
import { Tab, Switch } from '@headlessui/react'
import { Slider } from '@/components/UI/Slider'
import { cn } from '@/utils/cn'
import { Icon } from '@iconify/react'
import { Fragment, useRef, useState } from 'react'

function CustomSwitch({ checked, onChange }: { checked: boolean, onChange: (val: boolean) => void }) {
  return (
    <Switch
      checked={checked}
      onChange={onChange}
      className={cn(
        checked ? 'bg-blue-500' : 'bg-black/20 dark:bg-white/20',
        'relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
      )}
    >
      <span className="sr-only">Toggle</span>
      <span
        aria-hidden="true"
        className={cn(
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out'
        )}
      />
    </Switch>
  )
}

function SettingRow({ title, desc, children }: { title: string, desc: string, children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-black/5 dark:border-white/5 last:border-0 group">
      <div className="pr-8">
        <div className="font-medium text-sm text-[var(--color-text)] mb-1">{title}</div>
        <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed group-hover:text-[var(--color-text)]/80 transition-colors duration-300">{desc}</div>
      </div>
      <div className="shrink-0 flex items-center justify-end min-w-[120px]">
        {children}
      </div>
    </div>
  )
}

function SettingSliderRow({ title, desc, value, onChange, min, max, step, format = (v: number) => `${v}` }: any) {
  return (
    <SettingRow title={title} desc={desc}>
      <div className="flex items-center gap-4 w-48">
        <Slider value={value} onChange={onChange} min={min} max={max} step={step} className="flex-1" />
        <span className="w-12 text-right text-xs font-medium text-[var(--color-text-secondary)]">{format(value)}</span>
      </div>
    </SettingRow>
  )
}

export function SettingsPage() {
  const { settings, saveSettings, loading, error } = useSettingsStore()

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isScrolling, setIsScrolling] = useState(false)

  const handleScroll = () => {
    const el = scrollContainerRef.current
    const thumb = thumbRef.current
    if (!el || !thumb) return
    
    if (el.scrollHeight <= el.clientHeight) {
      if (isScrolling) setIsScrolling(false)
      return
    }

    const scrollRatio = el.scrollTop / (el.scrollHeight - el.clientHeight)
    const thumbHeight = Math.max(30, (el.clientHeight / el.scrollHeight) * el.clientHeight)
    const maxThumbTop = el.clientHeight - thumbHeight
    
    thumb.style.height = `${thumbHeight}px`
    thumb.style.transform = `translateY(${scrollRatio * maxThumbTop}px)`

    if (!isScrolling) setIsScrolling(true)
    
    if (scrollTimeout.current) window.clearTimeout(scrollTimeout.current)
    scrollTimeout.current = window.setTimeout(() => {
      setIsScrolling(false)
    }, 1000)
  }

  const tabs = [
    { id: 'general', name: '通用设置', icon: 'iconamoon:settings' },
    { id: 'appearance', name: '外观个性化', icon: 'iconamoon:color-palette' },
    { id: 'about', name: '关于 DeskZero', icon: 'iconamoon:information-circle' },
  ]

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100 select-none overflow-hidden font-sans">
      
      {loading && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-blue-500/20 z-50 overflow-hidden">
          <div className="w-1/3 h-full bg-blue-500 rounded-full animate-ping"></div>
        </div>
      )}

      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur-md text-white text-xs px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2">
          <Icon icon="iconamoon:attention-circle" />
          {error}
        </div>
      )}

      <Tab.Group vertical as="div" className="flex flex-1 overflow-hidden min-h-0 w-full">
          {/* Sidebar */}
          <Tab.List className="w-56 p-4 border-r border-black/5 dark:border-white/5 bg-white/50 dark:bg-[#1a1a1a]/50 backdrop-blur-xl flex flex-col gap-1.5 shadow-[2px_0_10px_rgba(0,0,0,0.02)] z-10">
            <div className="mb-6 px-3 pt-2">
              <div className="text-xl font-bold bg-gradient-to-br from-blue-500 to-indigo-500 bg-clip-text text-transparent inline-flex items-center gap-2 tracking-tight">
                <Icon icon="iconamoon:category" className="text-blue-500" />
                DeskZero
              </div>
            </div>
            
            {tabs.map((tab) => (
              <Tab as={Fragment} key={tab.id}>
                {({ selected }) => (
                  <button
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 outline-none',
                      selected 
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm' 
                        : 'text-[var(--color-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--color-text)]'
                    )}
                  >
                    <Icon icon={tab.icon} className={cn("text-lg", selected ? "text-blue-500" : "")} />
                    {tab.name}
                  </button>
                )}
              </Tab>
            ))}
          </Tab.List>

          {/* Content */}
          <div className="flex-1 relative overflow-hidden bg-transparent">
            <Tab.Panels 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="w-full h-full overflow-y-auto hidden-native-scrollbar"
            >
              <Tab.Panel className="p-8 max-w-3xl mx-auto min-h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-8 text-[var(--color-text)] tracking-tight">通用设置</h2>
              <div className="bg-white dark:bg-[#202020] rounded-2xl shadow-sm border border-black/5 dark:border-white/5 px-6 py-2">
                
                <SettingRow title="开机启动" desc="登录 Windows 时自动运行 DeskZero（功能开发中）">
                  <CustomSwitch checked={false} onChange={() => {}} />
                </SettingRow>

                <SettingRow title="双击隐藏桌面图标" desc="在桌面空白处双击可快速隐藏或显示所有图标">
                  <CustomSwitch 
                    checked={settings.doubleClickHide !== false} 
                    onChange={() => saveSettings({ doubleClickHide: !settings.doubleClickHide })} 
                  />
                </SettingRow>

                <SettingSliderRow 
                  title="桌面网格宽度" desc="调整桌面图标的水平对齐间距" 
                  value={settings.gridWidth || 80} onChange={(v: number) => saveSettings({ gridWidth: v })} 
                  min={60} max={150} step={5} format={(v: number) => `${v}px`} 
                />
                <SettingSliderRow 
                  title="桌面网格高度" desc="调整桌面图标的垂直对齐间距" 
                  value={settings.gridHeight || 104} onChange={(v: number) => saveSettings({ gridHeight: v })} 
                  min={60} max={150} step={5} format={(v: number) => `${v}px`} 
                />
                <SettingSliderRow 
                  title="水平网格间隙" desc="调整网格之间的水平不可放置区域" 
                  value={settings.gridGapX || 20} onChange={(v: number) => saveSettings({ gridGapX: v })} 
                  min={0} max={100} step={5} format={(v: number) => `${v}px`} 
                />
                <SettingSliderRow 
                  title="垂直网格间隙" desc="调整网格之间的垂直不可放置区域" 
                  value={settings.gridGapY || 20} onChange={(v: number) => saveSettings({ gridGapY: v })} 
                  min={0} max={100} step={5} format={(v: number) => `${v}px`} 
                />
                <SettingSliderRow 
                  title="软件名称文字大小" desc="调整桌面图标文字的显示大小" 
                  value={settings.fontSize || 12} onChange={(v: number) => saveSettings({ fontSize: v })} 
                  min={10} max={24} step={1} format={(v: number) => `${v}px`} 
                />

              </div>
            </Tab.Panel>

            <Tab.Panel className="p-8 max-w-3xl mx-auto min-h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-8 text-[var(--color-text)] tracking-tight">外观个性化</h2>
              <div className="bg-white dark:bg-[#202020] rounded-2xl shadow-sm border border-black/5 dark:border-white/5 px-6 py-2">
                
                <SettingRow title="主题" desc="选择应用的主题外观风格">
                  <div className="flex bg-black/5 dark:bg-white/5 rounded-lg p-1 gap-1">
                    {['light', 'dark', 'system'].map(t => (
                      <button 
                        key={t}
                        onClick={() => saveSettings({ theme: t as any })}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                          settings.theme === t 
                            ? "bg-white dark:bg-black/40 text-[var(--color-text)] shadow-sm" 
                            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                        )}
                      >
                        {t === 'light' ? '浅色' : t === 'dark' ? '深色' : '跟随系统'}
                      </button>
                    ))}
                  </div>
                </SettingRow>

                <SettingRow title="主题色" desc="设置高亮和焦点控件的强调色（开发中）">
                  <div className="flex gap-3">
                    {['#0078d4', '#8b5cf6', '#10b981', '#f43f5e'].map(color => (
                      <div 
                        key={color}
                        className="w-6 h-6 rounded-full cursor-pointer hover:scale-110 transition-transform shadow-inner"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </SettingRow>

                <SettingRow title="选中图标背景" desc="设置图标处于选中状态时的背板颜色">
                  <div className="flex bg-black/5 dark:bg-white/5 rounded-lg p-1 gap-1">
                    <button 
                      onClick={() => saveSettings({ selectedItemBackground: 'white' })}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                        settings.selectedItemBackground === 'white' 
                          ? "bg-white dark:bg-black/40 text-[var(--color-text)] shadow-sm" 
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                      )}
                    >
                      明亮半透明
                    </button>
                    <button 
                      onClick={() => saveSettings({ selectedItemBackground: 'black' })}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                        settings.selectedItemBackground === 'black' 
                          ? "bg-white dark:bg-black/40 text-[var(--color-text)] shadow-sm" 
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                      )}
                    >
                      暗色半透明
                    </button>
                  </div>
                </SettingRow>

                <SettingRow title="选中图标毛玻璃效果" desc="为选中项背板添加高斯模糊效果">
                  <CustomSwitch 
                    checked={!!settings.selectedItemBlur} 
                    onChange={() => saveSettings({ selectedItemBlur: !settings.selectedItemBlur })} 
                  />
                </SettingRow>

                <SettingRow title="全局毛玻璃效果" desc="为收纳盒等容器和界面元素添加毛玻璃">
                  <CustomSwitch 
                    checked={!!settings.globalBlur} 
                    onChange={() => saveSettings({ globalBlur: !settings.globalBlur })} 
                  />
                </SettingRow>

                <SettingRow title="壁纸模糊穿透兼容模式" desc="若毛玻璃无法穿透至桌面壁纸，请开启此选项">
                  <CustomSwitch 
                    checked={!!settings.wallpaperCompatible} 
                    onChange={() => saveSettings({ wallpaperCompatible: !settings.wallpaperCompatible })} 
                  />
                </SettingRow>

                <SettingRow title="隐藏快捷方式角标" desc="隐藏桌面快捷方式左下角的小箭头标识">
                  <CustomSwitch 
                    checked={!!settings.hideShortcutBadge} 
                    onChange={() => saveSettings({ hideShortcutBadge: !settings.hideShortcutBadge })} 
                  />
                </SettingRow>

                <SettingRow title="图标发光效果" desc="为桌面图标添加柔和的环境发光效果">
                  <CustomSwitch 
                    checked={!!settings.iconGlow} 
                    onChange={() => saveSettings({ iconGlow: !settings.iconGlow })} 
                  />
                </SettingRow>

                {settings.iconGlow && (
                  <div className="pl-6 pb-2 relative before:absolute before:left-2 before:top-0 before:bottom-6 before:w-px before:bg-black/10 dark:before:bg-white/10">
                    <SettingSliderRow 
                      title="发光范围" desc="调整图标发光效果的扩散程度" 
                      value={settings.iconGlowRadius ?? 12} onChange={(v: number) => saveSettings({ iconGlowRadius: v })} 
                      min={2} max={30} step={1} format={(v: number) => `${v}px`} 
                    />
                    <SettingSliderRow 
                      title="发光强度" desc="调整发光效果的透明度和亮度" 
                      value={settings.iconGlowIntensity ?? 0.6} onChange={(v: number) => saveSettings({ iconGlowIntensity: v })} 
                      min={0.1} max={1.0} step={0.05} format={(v: number) => `${Math.round(v * 100)}%`} 
                    />
                  </div>
                )}

                <SettingSliderRow 
                  title="图标不透明度" desc="调整桌面所有图标的整体不透明度" 
                  value={settings.iconOpacity ?? 1.0} onChange={(v: number) => saveSettings({ iconOpacity: v })} 
                  min={0.1} max={1.0} step={0.05} format={(v: number) => `${Math.round(v * 100)}%`} 
                />
                
                <SettingSliderRow 
                  title="字体不透明度" desc="调整桌面图标文字的不透明度" 
                  value={settings.textOpacity ?? 1.0} onChange={(v: number) => saveSettings({ textOpacity: v })} 
                  min={0.1} max={1.0} step={0.05} format={(v: number) => `${Math.round(v * 100)}%`} 
                />

              </div>
            </Tab.Panel>

            <Tab.Panel className="p-8 max-w-3xl mx-auto min-h-full flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-500">
              <div className="relative group cursor-pointer mb-8 flex justify-center">
                <div className="absolute inset-0 bg-blue-500 rounded-3xl blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                <img src="/icon.png" alt="DeskZero Logo" className="relative w-28 h-28 object-contain drop-shadow-xl hover:scale-105 transition-transform duration-500" />
              </div>
              
              <h2 className="text-3xl font-extrabold text-[var(--color-text)] tracking-tight">DeskZero</h2>
              <div className="text-sm font-medium text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full mt-3">
                Beta Version 0.1.0
              </div>
              
              <p className="text-[var(--color-text-secondary)] max-w-md text-center mt-6 leading-relaxed">
                一款现代化的 Windows 桌面整理工具，为您提供毛玻璃质感、丝滑的拖拽动画与高效的分区收纳体验。让桌面重回整洁与纯粹。
              </p>
              
              <div className="mt-12 text-xs text-[var(--color-text-secondary)]/50">
                &copy; 2026 DeskZero Team. All rights reserved.
              </div>
              </Tab.Panel>
            </Tab.Panels>
            
            {/* Custom Animated Scrollbar Thumb */}
            <div 
              ref={thumbRef}
              className={cn(
                "absolute top-0 right-1 w-1.5 bg-black/30 dark:bg-white/30 rounded-full pointer-events-none",
                "transition-opacity duration-300 ease-in-out",
                isScrolling ? "opacity-100" : "opacity-0"
              )}
            />
          </div>
      </Tab.Group>
    </div>
  )
}
