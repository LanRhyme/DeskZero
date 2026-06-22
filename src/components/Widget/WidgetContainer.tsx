import { motion } from "framer-motion";
import { Trash2, Settings, Shield } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDrag } from "@/hooks/useDrag";
import { ConfirmDialog } from "@/components/UI/ConfirmDialog";
import { ContextMenu } from "@/components/ContextMenu/ContextMenu";
import type { MenuItem } from "@/components/ContextMenu/ContextMenu";
import { useContainerStore } from "@/stores/containerStore";
import { useDesktopStore } from "@/stores/desktopStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWidgetStore } from "@/stores/widgetStore";
import type { Container as ContainerType } from "@/types/container";
import type { WidgetConfig, ConfigField } from "@/types/widget";
import { cn } from "@/utils/cn";
import { hexToRgb } from "@/utils/color";
import { snapSize, snapPosition } from "@/utils/grid";
import { getWidget, getDefaultWidgetConfig } from "./WidgetRegistry";
import { CustomWidgetIframe } from "./CustomWidgetIframe";
import { WidgetSettingsPanel } from "./WidgetSettingsPanel";

interface WidgetContainerProps {
  container: ContainerType;
}

export function WidgetContainer({ container }: WidgetContainerProps) {
  const { t } = useTranslation();
  const {
    updateContainerPosition,
    updateContainerSize,
    updateContainerGeometry,
    updateContainerStyle,
    deleteContainer,
  } = useContainerStore();
  const { settings } = useSettingsStore();
  const { wallpaper } = useDesktopStore();
  const { customWidgets } = useWidgetStore();

  const [resizePosOffset, setResizePosOffset] = useState({ x: 0, y: 0 });
  const resizeOffsetRef = useRef({ x: 0, y: 0 });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [customConfigSchema, setCustomConfigSchema] = useState<ConfigField[] | null>(null);
  const [menuState, setMenuState] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({ visible: false, x: 0, y: 0 });

  // 从 style 中读取 widgetConfig
  const widgetConfig: WidgetConfig = (container.style as any).config || getDefaultWidgetConfig("clock")!;
  const transparentBackground = widgetConfig.config?.transparentBackground === true;

  // 自定义小组件 IPC 权限
  const isCustom = widgetConfig.widgetType === "custom";
  const customEntry = isCustom ? customWidgets.find((w) => w.htmlPath === widgetConfig.customHtmlPath) : undefined;
  const ipcEnabled = customEntry?.ipcEnabled === true;

  // 整个卡片拖拽（不需要单独的 dragHandle）
  const { ref, pos, isDragging, listeners } = useDrag(container.position, {
    disabled: isEditing,
    onDragEnd: (newPos) => {
      const snapped = snapPosition(newPos.x, newPos.y);
      updateContainerPosition(container.id, snapped);
    },
  });

  // 双向调整大小
  const [isResizing, setIsResizing] = useState(false);
  const [size, setSize] = useState(container.size);

  useEffect(() => {
    setSize(container.size);
  }, [container.size.width, container.size.height]);

  const handleDelete = async () => {
    await deleteContainer(container.id);
  };

  const { setCustomWidgetIpcEnabled } = useWidgetStore.getState();

  const contextMenuItems: MenuItem[] = [
    {
      label: t("widget.settings"),
      icon: <Settings size={14} />,
      onClick: () => {
        setIsSettingsOpen(true);
      },
    },
    ...(isCustom && !ipcEnabled
      ? [
          {
            label: t("widget.grantIpc", "授权命令调用"),
            icon: <Shield size={14} />,
            onClick: () => {
              if (widgetConfig.customHtmlPath) {
                setCustomWidgetIpcEnabled(widgetConfig.customHtmlPath, true);
              }
            },
          },
        ]
      : []),
    { label: "", divider: true },
    {
      label: t("widget.remove"),
      icon: <Trash2 size={14} />,
      onClick: () => setShowDeleteConfirm(true),
    },
  ];

  const sizeRef = useRef(size);
  sizeRef.current = size;

  const handleResizePointerDown = (
    e: React.PointerEvent,
    direction: "br" | "bl",
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    useDesktopStore.getState().setIsGlobalDragging(true);

    // 锁定指针到调整手柄，防止 iframe 等子元素抢夺事件
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;
    const startPosX = pos.x;
    const startPosY = pos.y;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (direction === "br") {
        const rawWidth = Math.max(10, startWidth + deltaX);
        const rawHeight = Math.max(10, startHeight + deltaY);
        const snapped = snapSize(rawWidth, rawHeight);
        setSize(snapped);
      } else if (direction === "bl") {
        const rawWidth = Math.max(10, startWidth - deltaX);
        const rawHeight = Math.max(10, startHeight + deltaY);
        const possiblePosX = startPosX + startWidth - Math.max(10, startWidth - deltaX);
        
        const snapped = snapSize(rawWidth, rawHeight);
        setSize(snapped);
        if (possiblePosX >= 0) {
          const targetXOffset = startWidth - snapped.width;
          setResizePosOffset({ x: targetXOffset, y: 0 });
          resizeOffsetRef.current = { x: targetXOffset, y: 0 };
        }
      }
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      useDesktopStore.getState().setIsGlobalDragging(false);
      const snappedSize = snapSize(sizeRef.current.width, sizeRef.current.height);
      if (direction === "bl") {
        const snappedPos = snapPosition(startPosX + resizeOffsetRef.current.x, startPosY);
        updateContainerGeometry(container.id, snappedPos, snappedSize);
        setResizePosOffset({ x: 0, y: 0 });
        resizeOffsetRef.current = { x: 0, y: 0 };
      } else {
        updateContainerSize(container.id, snappedSize);
      }
      setSize(snappedSize);
      target.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  // 样式计算
  const bgOpacity = container.style.backgroundOpacity ?? 0.5;
  const isStickyNote = widgetConfig.widgetType === "stickyNote";
  const stickyColor = widgetConfig.config?.color || "#ffeb3b";

  const customBackground = isStickyNote
    ? `rgba(${hexToRgb(stickyColor)}, ${bgOpacity})`
    : container.style.backgroundColor === "theme" || !container.style.backgroundColor
      ? `rgba(var(--color-container-bg-rgb), ${bgOpacity})`
      : container.style.backgroundColor.startsWith("#")
        ? `rgba(${hexToRgb(container.style.backgroundColor)}, ${bgOpacity})`
        : container.style.backgroundColor;

  const cornerRadius = container.style.cornerRadius ?? 12;

  // 查找注册的小组件
  const widgetReg = getWidget(widgetConfig.widgetType);

  // 小组件配置变更处理
  const handleWidgetConfigChange = (newConfig: WidgetConfig) => {
    updateContainerStyle(container.id, { config: newConfig } as any);
  };

  return (
    <>
      <motion.div
        ref={ref}
        {...listeners}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          borderRadius: cornerRadius,
          zIndex: isDragging || isResizing ? 40 : 10,
          translate: "var(--container-parallax-x, 0px) var(--container-parallax-y, 0px)",
          backgroundColor:
            transparentBackground
              ? "transparent"
              : settings.wallpaperCompatible && settings.globalBlur && wallpaper
                ? "transparent"
                : customBackground,
          backdropFilter:
            transparentBackground
              ? "none"
              : (!settings.wallpaperCompatible || !wallpaper) && settings.globalBlur
                ? "var(--backdrop-blur)"
                : "none",
          WebkitBackdropFilter:
            transparentBackground
              ? "none"
              : (!settings.wallpaperCompatible || !wallpaper) && settings.globalBlur
                ? "var(--backdrop-blur)"
                : "none",
          cursor: isDragging ? "grabbing" : "grab",
        }}
        initial={{
          opacity: 0,
          scale: 0.95,
          x: pos.x,
          y: pos.y,
          width: size.width,
          height: size.height,
        }}
        animate={{
          opacity: isDragging ? 0.9 : 1,
          scale: 1,
          x: pos.x + resizePosOffset.x,
          y: pos.y + resizePosOffset.y,
          width: size.width,
          height: size.height,
        }}
        transition={
          isDragging
            ? { duration: 0 }
            : isResizing
              ? { type: "tween", duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }
              : { type: "spring", stiffness: 400, damping: 30 }
        }
        className={cn(
          "flex flex-col overflow-hidden select-none relative touch-none",
          "transition-[box-shadow] duration-200",
          isHovered && !isDragging && "shadow-lg",
          isDragging && "shadow-2xl",
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuState({ visible: true, x: e.clientX, y: e.clientY });
        }}
      >
        {/* 壁纸模糊层 */}
        {settings.wallpaperCompatible && settings.globalBlur && wallpaper && !transparentBackground && (
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{ zIndex: -1, borderRadius: "inherit" }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${wallpaper})`,
                backgroundPosition: `calc(0px - ${pos.x + resizePosOffset.x}px) calc(0px - ${pos.y + resizePosOffset.y}px)`,
                backgroundSize: "100vw 100vh",
                filter: "blur(20px)",
              }}
            />
            <div className="absolute inset-0" style={{ backgroundColor: customBackground }} />
          </div>
        )}

        {/* 小组件内容 — 直接填满整个区域，无标题栏 */}
        <div className="relative flex-1 overflow-hidden w-full h-full">
          {widgetReg ? (
            <widgetReg.component
              config={widgetConfig}
              onConfigChange={handleWidgetConfigChange}
              containerId={container.id}
              width={size.width}
              height={size.height}
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              backgroundOpacity={container.style.backgroundOpacity}
            />
          ) : widgetConfig.widgetType === "custom" ? (
            <CustomWidgetIframe
              config={widgetConfig}
              onConfigChange={handleWidgetConfigChange}
              containerId={container.id}
              width={size.width}
              height={size.height}
              ipcEnabled={ipcEnabled}
              onShowConfig={() => setIsSettingsOpen(true)}
              onConfigSchema={setCustomConfigSchema}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs opacity-50">
              {t("widget.unknownType")}{widgetConfig.widgetType}
            </div>
          )}
        </div>

        {/* 调整大小手柄 — 仅悬停时显示 */}
        <div
          className={cn(
            "absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize z-50 transition-opacity duration-200",
            isHovered && !isDragging ? "opacity-60 hover:opacity-100" : "opacity-0",
          )}
          onPointerDown={(e) => handleResizePointerDown(e, "bl")}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-secondary)] transform -scale-x-100">
            <polyline points="22 12 22 22 12 22" /><line x1="22" y1="22" x2="12" y2="12" />
          </svg>
        </div>
        <div
          className={cn(
            "absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-50 transition-opacity duration-200",
            isHovered && !isDragging ? "opacity-60 hover:opacity-100" : "opacity-0",
          )}
          onPointerDown={(e) => handleResizePointerDown(e, "br")}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-secondary)]">
            <polyline points="22 12 22 22 12 22" /><line x1="22" y1="22" x2="12" y2="12" />
          </svg>
        </div>
      </motion.div>

      {/* 右键菜单 */}
      {menuState.visible && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={contextMenuItems}
          onClose={() => setMenuState((prev) => ({ ...prev, visible: false }))}
        />
      )}

      {/* 设置面板 — portal 渲染到 body */}
      {isSettingsOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99] settings-backdrop"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="fixed z-[100] pointer-events-auto"
              style={{
                left: pos.x + size.width + 10,
                top: pos.y,
                width: 288,
              }}
            >
              <WidgetSettingsPanel
                container={container}
                widgetConfig={widgetConfig}
                onClose={() => setIsSettingsOpen(false)}
                customConfigSchema={isCustom ? customConfigSchema : null}
              />
            </motion.div>
          </div>,
          document.body,
        )}

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t("widget.removeTitle")}
        message={t("widget.removeConfirm", { name: container.name })}
        confirmLabel={t("common.remove")}
        onConfirm={async () => {
          setShowDeleteConfirm(false);
          await handleDelete();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
