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
