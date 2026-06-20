import { motion, AnimatePresence } from "framer-motion";
import { Monitor, Clock, StickyNote, Activity, Plus, X, FileCode } from "lucide-react";
import { useState } from "react";
import { getAllWidgets } from "./WidgetRegistry";
import { useWidgetStore, type CustomWidgetEntry } from "@/stores/widgetStore";
import { useContainerStore } from "@/stores/containerStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";
import type { Position } from "@/types/container";
import type { WidgetConfig } from "@/types/widget";

interface WidgetSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  position: Position;
}

const iconMap: Record<string, React.ReactNode> = {
  clock: <Clock size={24} />,
  stickyNote: <StickyNote size={24} />,
  systemMonitor: <Activity size={24} />,
  custom: <FileCode size={24} />,
};

export function WidgetSelectorDialog({
  isOpen,
  onClose,
  position,
}: WidgetSelectorDialogProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const builtInWidgets = getAllWidgets();
  const { customWidgets, addCustomWidget } = useWidgetStore();
  const createContainer = useContainerStore((s) => s.createContainer);

  const handleCreate = async () => {
    if (!selectedType) return;

    try {
      const reg = builtInWidgets.find((w) => w.widgetType === selectedType);
      if (reg) {
        const { settings: s } = useSettingsStore.getState();
        const gw = s.gridWidth || 80;
        const gh = s.gridHeight || 104;
        const gx = s.gridGapX ?? 20;
        const gy = s.gridGapY ?? 20;
        const stepX = gw + gx;
        const stepY = gh + gy;
        const widgetConfig = { ...reg.defaultConfig };

        const container = await createContainer(
          reg.name,
          "widget",
          position,
        );

        const { updateContainerStyle, updateContainerSize } = useContainerStore.getState();
        updateContainerStyle(container.id, { config: widgetConfig } as any);
        updateContainerSize(container.id, {
          width: reg.defaultSize.width * stepX - gx,
          height: reg.defaultSize.height * stepY - gy,
        });

        // 立即写入数据库，不等防抖
        const updated = useContainerStore.getState().containers.find(c => c.id === container.id);
        if (updated) {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("update_container_full", { container: updated });
        }

        useToastStore.getState().addToast(`已创建${reg.name}小组件`, "success");
      }
    } catch (e: any) {
      useToastStore.getState().addToast("创建小组件失败: " + String(e), "error");
    }
    onClose();
  };

  const handleAddCustom = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        filters: [{ name: "HTML 文件", extensions: ["html", "htm"] }],
        multiple: false,
        title: "选择自定义小组件 HTML 文件",
      });
      if (selected) {
        const htmlPath = Array.isArray(selected) ? selected[0] : selected;
        const fileName = htmlPath.substring(
          Math.max(htmlPath.lastIndexOf("\\"), htmlPath.lastIndexOf("/")) + 1,
        );
        const entry: CustomWidgetEntry = {
          htmlPath,
          name: fileName.replace(/\.html?$/i, ""),
        };
        addCustomWidget(entry);

        const container = await createContainer(entry.name, "widget", position);
        const widgetConfig: WidgetConfig = {
          widgetType: "custom",
          customHtmlPath: htmlPath,
          config: {},
        };
        const { updateContainerStyle } = useContainerStore.getState();
        updateContainerStyle(container.id, { config: widgetConfig } as any);

        // 立即写入数据库
        const updated = useContainerStore.getState().containers.find(c => c.id === container.id);
        if (updated) {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("update_container_full", { container: updated });
        }

        useToastStore.getState().addToast(`已添加自定义小组件: ${entry.name}`, "success");
      }
    } catch (e: any) {
      useToastStore.getState().addToast("添加自定义小组件失败: " + String(e), "error");
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            className="relative bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-3xl rounded-xl shadow-2xl border border-black/5 dark:border-white/10 ring-1 ring-black/5 w-[460px] max-h-[420px] flex flex-col overflow-hidden"
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/5 dark:border-white/5">
              <h2 className="text-sm font-medium text-[var(--color-text)]">添加小组件</h2>
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-[var(--color-text-secondary)]"
              >
                <X size={14} />
              </button>
            </div>

            {/* 小组件列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* 内置小组件 */}
              <div>
                <div className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-2.5">
                  内置小组件
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {builtInWidgets.map((w) => (
                    <button
                      key={w.widgetType}
                      onClick={() => setSelectedType(w.widgetType)}
                      className={`group flex flex-col items-center gap-2 p-3.5 rounded-xl transition-all duration-200 ${
                        selectedType === w.widgetType
                          ? "bg-[var(--color-accent)] text-white shadow-md shadow-[var(--color-accent)]/25"
                          : "bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-[var(--color-text)]"
                      }`}
                    >
                      <div className={selectedType === w.widgetType ? "text-white" : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors"}>
                        {iconMap[w.widgetType] || <Monitor size={24} />}
                      </div>
                      <span className="text-xs font-medium">{w.name}</span>
                      <span className={`text-[10px] ${selectedType === w.widgetType ? "text-white/70" : "text-[var(--color-text-secondary)] opacity-50"}`}>
                        {w.defaultSize.width}×{w.defaultSize.height}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 自定义小组件 */}
              <div>
                <div className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-2.5">
                  自定义小组件
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {customWidgets.map((w) => (
                    <button
                      key={w.htmlPath}
                      onClick={() => setSelectedType("custom")}
                      className={`group flex flex-col items-center gap-2 p-3.5 rounded-xl transition-all duration-200 ${
                        selectedType === "custom"
                          ? "bg-[var(--color-accent)] text-white shadow-md shadow-[var(--color-accent)]/25"
                          : "bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-[var(--color-text)]"
                      }`}
                    >
                      <FileCode size={24} className={selectedType === "custom" ? "text-white" : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors"} />
                      <span className="text-xs font-medium truncate max-w-full">{w.name}</span>
                    </button>
                  ))}
                  <button
                    onClick={handleAddCustom}
                    className="flex flex-col items-center gap-2 p-3.5 rounded-xl border border-dashed border-black/10 dark:border-white/10 hover:border-[var(--color-accent)]/40 transition-all duration-200 text-[var(--color-text-secondary)]"
                  >
                    <Plus size={24} className="opacity-30" />
                    <span className="text-xs opacity-50">导入 HTML</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-black/5 dark:border-white/5">
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-xs rounded-lg border border-transparent bg-black/5 dark:bg-white/5 text-[var(--color-text)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!selectedType}
                className="px-4 py-1.5 text-xs rounded-lg border border-transparent bg-[var(--color-accent)] text-white disabled:opacity-40 transition-all shadow-md shadow-[var(--color-accent)]/25 hover:shadow-lg"
              >
                创建
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
