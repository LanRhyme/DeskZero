import { useCallback, useEffect, useRef, useState } from "react";
import type { WidgetComponentProps } from "@/types/widget";
import { cn } from "@/utils/cn";

export function StickyNoteWidget({
  config,
  onConfigChange,
  isEditing: propsEditing,
  setIsEditing: propsSetIsEditing,
}: WidgetComponentProps) {
  const content = config.config?.content || "";

  // 新增排版配置
  const fontFamily = config.config?.fontFamily || "default"; // "default" | "mono" | "kaiti"
  const fontSize = config.config?.fontSize || 14;
  const lineHeight = config.config?.lineHeight || 1.5;
  const textAlign = config.config?.textAlign || "left";
  const showTape = config.config?.showTape !== false;
  const showLines = config.config?.showLines !== false;
  const fontColor = config.config?.fontColor || "#1f2937";

  const [localContent, setLocalContent] = useState(content);
  const [localEditing, setLocalEditing] = useState(false);

  const isEditing = propsEditing !== undefined ? propsEditing : localEditing;
  const setIsEditing = propsSetIsEditing !== undefined ? propsSetIsEditing : setLocalEditing;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const handleChange = useCallback(
    (value: string) => {
      setLocalContent(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onConfigChange({
          ...config,
          config: { ...config.config, content: value },
        });
      }, 300);
    },
    [config, onConfigChange],
  );

  // 滚动处理函数 (用于自定义滚动条)
  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const thumb = thumbRef.current;
    if (!el || !thumb) return;

    if (el.scrollHeight <= el.clientHeight) {
      if (isScrolling) setIsScrolling(false);
      return;
    }

    const scrollRatio = el.scrollTop / (el.scrollHeight - el.clientHeight);
    const thumbHeight = Math.max(
      16,
      (el.clientHeight / el.scrollHeight) * el.clientHeight,
    );
    const maxThumbTop = el.clientHeight - thumbHeight;

    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${scrollRatio * maxThumbTop}px)`;

    if (!isScrolling) setIsScrolling(true);

    if (scrollTimeout.current) window.clearTimeout(scrollTimeout.current);
    scrollTimeout.current = window.setTimeout(() => {
      setIsScrolling(false);
    }, 1000);
  };

  // 聚焦控制
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const timer = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          // 光标移至末尾
          const length = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(length, length);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isEditing]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);

  // 字体族匹配
  const fontStyleClass =
    fontFamily === "mono"
      ? "font-mono"
      : fontFamily === "kaiti"
        ? "font-serif tracking-wide"
        : "font-sans";

  // 基础样式：背景色设为透明，统一由外层 WidgetContainer 渲染以彻底解耦不透明度和底色！
  const cardStyle: React.CSSProperties = {
    backgroundColor: "transparent",
    borderRadius: 8,
  };

  const textStyle: React.CSSProperties = {
    fontFamily: fontFamily === "kaiti" ? "STKaiti, KaiTi, serif" : undefined,
    fontSize: `${fontSize}px`,
    lineHeight: lineHeight,
    textAlign: textAlign as any,
    color: fontColor, // 应用配置好的文字颜色
  };

  // 信纸横线 CSS 渐变底图
  const lineBackgroundStyle = showLines
    ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,0) 95%, rgba(31, 41, 55, 0.08) 95%)`,
        backgroundSize: `100% ${fontSize * lineHeight}px`,
        backgroundAttachment: "local" as const,   // 解决滚动时背景横线不随文字移动的问题
        backgroundOrigin: "content-box" as const, // 解决 padding 导致的第一行文字与横线错位问题
      }
    : {};

  return (
    <div
      className="w-full h-full flex flex-col relative group transition-all duration-200 overflow-hidden cursor-text"
      style={cardStyle}
      onDoubleClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        setIsEditing(true);
      }}
    >
      {/* 磨砂胶带装饰 */}
      {showTape && (
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-16 h-3.5 bg-white/25 border border-white/20 backdrop-blur-[1px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] rotate-[-2deg] z-10 pointer-events-none"
          style={{
            clipPath: "polygon(0% 15%, 5% 0%, 95% 0%, 100% 15%, 98% 85%, 100% 100%, 0% 100%, 2% 85%)" // 仿真手撕毛边
          }}
        />
      )}

      {/* 便签只读静态内容 — pointer-events-none，当处于编辑状态时 opacity-0，通过鼠标滚轮可以自由滚动 */}
      <div
        className={cn(
          "absolute inset-0 p-4 overflow-y-auto whitespace-pre-wrap select-none pointer-events-none hidden-native-scrollbar transition-opacity duration-150",
          isEditing ? "opacity-0" : "opacity-100",
          fontStyleClass
        )}
        onScroll={handleScroll}
        style={{ ...textStyle, ...lineBackgroundStyle }}
      >
        {localContent.trim() || (
          <span className="opacity-35 italic text-xs">双击此处开始输入...</span>
        )}
      </div>

      {/* 便签输入文本框 — 仅在编辑模式下 opacity-100 且 pointer-events-auto 拦截事件以防拖动冲突 */}
      <textarea
        ref={textareaRef}
        className={cn(
          "absolute inset-0 w-full h-full p-4 bg-transparent resize-none outline-none placeholder-gray-500 overflow-y-auto hidden-native-scrollbar transition-opacity duration-150",
          isEditing ? "opacity-100 pointer-events-auto z-10" : "opacity-0 pointer-events-none -z-10",
          fontStyleClass
        )}
        placeholder="输入便签内容..."
        value={localContent}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setIsEditing(false)}
        onScroll={handleScroll}
        onPointerDown={(e) => e.stopPropagation()} // 阻止拖拽捕获冒泡
        onDoubleClick={(e) => e.stopPropagation()} // 阻止双击冒泡
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.ctrlKey) {
            setIsEditing(false);
          }
        }}
        style={{ ...textStyle, ...lineBackgroundStyle, minHeight: 0 }}
      />

      {/* 编辑快捷键提示 */}
      {isEditing && (
        <div className="absolute bottom-1 right-2 text-[9px] text-gray-800/40 select-none pointer-events-none z-20">
          Ctrl + Enter 完成编辑
        </div>
      )}

      {/* 自定义精致滚动滑块 */}
      <div
        ref={thumbRef}
        className={cn(
          "absolute top-1.5 right-1 w-1 bg-gray-800/25 rounded-full pointer-events-none z-30",
          "transition-opacity duration-300 ease-in-out backdrop-blur-[0.5px]",
          isScrolling ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}
