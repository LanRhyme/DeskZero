import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Quote as QuoteIcon } from "lucide-react";
import type { WidgetComponentProps } from "@/types/widget";
import { useToastStore } from "@/stores/toastStore";
import { cn } from "@/utils/cn";

// 本地 20 句经典 fallback 语录库
const FALLBACK_LIST = [
  { hitokoto: "每一个不曾起舞的日子，都是对生命的辜负。", creator: "尼采", from: "查拉图斯特拉如是说" },
  { hitokoto: "凡是过往，皆为序章。", creator: "莎士比亚", from: "暴风雨" },
  { hitokoto: "Stay hungry, stay foolish.", creator: "Steve Jobs", from: "斯坦福演讲" },
  { hitokoto: "世界上只有一种真正的英雄主义，那就是认清生活的真相后依然热爱它。", creator: "罗曼·罗兰", from: "米开朗琪罗传" },
  { hitokoto: "屏幕前的你，今天也要加油哦。", creator: "DeskZero", from: "系统助手" },
  { hitokoto: "重要的东西，用眼睛是看不见的。", creator: "圣埃克苏佩里", from: "小王子" },
  { hitokoto: "人生的旅途，前途很远，也很暗。然而不要怕，不怕的人面前才有路。", creator: "鲁迅", from: "热风" },
  { hitokoto: "生活就像一盒巧克力，你永远不知道下一颗是什么味道。", creator: "阿甘", from: "阿甘正传" },
  { hitokoto: "既然选择了远方，便只顾风雨兼程。", creator: "汪国真", from: "热爱生命" },
  { hitokoto: "心之所向，素履以往。", creator: "七堇年", from: "尘曲" },
  { hitokoto: "追光的人，终会身披万丈光芒。", creator: "佚名", from: "网络" },
  { hitokoto: "只要路是对的，就不怕路远。", creator: "佚名", from: "网络" },
  { hitokoto: "答案在路上，自由在风里。", creator: "佚名", from: "网络" },
  { hitokoto: "你若盛开，清风自来。", creator: "三毛", from: "送你一匹马" },
  { hitokoto: "时间会给你答案。", creator: "佚名", from: "网络" },
  { hitokoto: "行百里者半九十。", creator: "刘向", from: "战国策" },
  { hitokoto: "我们听到的一切都只是一个观点，不是事实。", creator: "马可·奥勒留", from: "沉思录" },
  { hitokoto: "所有大人的曾经，都只是个孩子。", creator: "圣埃克苏佩里", from: "小王子" },
  { hitokoto: "比起失去，得不到要好受得多。", creator: "佚名", from: "网络" },
  { hitokoto: "无论何时，都别忘了内心的光芒。", creator: "DeskZero", from: "系统助手" },
];

export function HitokotoWidget({
  config,
  width,
  height,
}: WidgetComponentProps) {
  const c = config.config;
  const isCustomMode = c.sourceMode === "custom";
  const customText = c.customText || "";
  const customAuthor = c.customAuthor || "";
  const customFrom = c.customFrom || "";

  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [from, setFrom] = useState("");
  const [loading, setLoading] = useState(false);

  const clickStartPos = useRef({ x: 0, y: 0 });

  // 获取一言的函数
  const fetchHitokoto = async () => {
    if (isCustomMode) {
      setText(customText);
      setAuthor(customAuthor);
      setFrom(customFrom);
      return;
    }

    setLoading(true);
    try {
      let url = "https://v1.hitokoto.cn/";
      if (c.category && c.category !== "all") {
        url += `?c=${c.category}`;
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4秒超时
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error("API response error");
      const data = await response.json();
      
      setText(data.hitokoto);
      setAuthor(data.creator || "");
      setFrom(data.from || "");
    } catch (err) {
      // 失败时随机选取本地 fallback 语录
      const randomItem = FALLBACK_LIST[Math.floor(Math.random() * FALLBACK_LIST.length)];
      setText(randomItem.hitokoto);
      setAuthor(randomItem.creator || "");
      setFrom(randomItem.from || "");
    } finally {
      setLoading(false);
    }
  };

  // 配置项监听 & 首次加载
  useEffect(() => {
    fetchHitokoto();
  }, [isCustomMode, customText, customAuthor, customFrom, c.category]);

  // 刷新定时器
  useEffect(() => {
    if (isCustomMode) return;
    const intervalSec = Number(c.refreshInterval) || 3600;
    if (intervalSec <= 0) return;

    const timer = setInterval(() => {
      fetchHitokoto();
    }, intervalSec * 1000);

    return () => clearInterval(timer);
  }, [isCustomMode, c.refreshInterval, c.category]);

  // Pointer 事件：防止拖拽小组件时触发点击动作
  const handlePointerDown = (e: React.PointerEvent) => {
    clickStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = async (e: React.MouseEvent) => {
    const dx = Math.abs(e.clientX - clickStartPos.current.x);
    const dy = Math.abs(e.clientY - clickStartPos.current.y);
    // 移动距离小于 3px 才认定为单纯的点击
    if (dx < 3 && dy < 3) {
      if (c.clickAction === "refresh" && !isCustomMode) {
        await fetchHitokoto();
      } else if (c.clickAction === "copy") {
        try {
          const suffix = author || from ? ` —— ${author}${from ? `《${from}》` : ""}` : "";
          await navigator.clipboard.writeText(`${text}${suffix}`);
          useToastStore.getState().addToast("一言语录已成功复制到剪贴板", "success");
        } catch (err) {
          useToastStore.getState().addToast("复制失败，请重试", "error");
        }
      }
    }
  };

  // 1. 高度自适应：如果高度较扁（如高度 <= 100px），采用更紧凑的内边距和排版间距
  const isCompactHeight = height <= 100;
  const paddingClass = isCompactHeight ? "px-4.5 py-2.5" : "p-6";
  const authorMarginClass = isCompactHeight ? "mt-1" : "mt-3.5";
  const quoteIconSize = isCompactHeight ? 16 : 24;
  const quoteIconStroke = isCompactHeight ? 1.2 : 1.5;

  // 2. 字号长度惩罚与安全防区限制
  const fontSizeScale = c.fontSizeScale ?? 1.0;
  const textLength = text.length || 1;
  // 基础字号比例计算
  let baseFontSize = Math.min(width * 0.08, height * 0.22) * fontSizeScale;
  
  // 字数惩罚缩减
  if (textLength > 15) {
    const shrinkFactor = Math.max(0.65, 1 - (textLength - 15) * 0.012);
    baseFontSize *= shrinkFactor;
  }
  // 确保在任何屏幕/字数下都有最低 11px 能见度和最高 28px 的视觉限制
  baseFontSize = Math.max(11, Math.min(28, baseFontSize));

  // 文本对齐方式映射
  const alignClass =
    c.textAlign === "left"
      ? "text-left items-start"
      : c.textAlign === "right"
        ? "text-right items-end"
        : "text-center items-center";

  // 文字颜色与样式计算
  const fontColor = c.fontColor || "theme";
  const customHex = fontColor.startsWith("#") ? fontColor : undefined;

  const fontColorStyle: React.CSSProperties = customHex
    ? { color: customHex }
    : {};

  const fontColorClass = cn(
    fontColor === "theme" && "text-[var(--color-text)]",
    fontColor === "accent" && "text-[var(--color-accent)]",
    fontColor === "gradient-rainbow" && "bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent"
  );

  // 引号的颜色与不透明度设置
  const quoteColorClass = cn(
    fontColor === "theme" && "text-[var(--color-text)] opacity-[0.09]",
    fontColor === "accent" && "text-[var(--color-accent)] opacity-[0.12]",
    fontColor === "gradient-rainbow" && "text-pink-500 dark:text-purple-400 opacity-[0.1]"
  );

  return (
    <motion.div
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      whileTap={{ scale: 0.96, opacity: 0.85 }}
      transition={{ type: "spring", stiffness: 450, damping: 20 }}
      className={cn(
        "relative w-full h-full flex flex-col justify-center select-none cursor-pointer transition-colors duration-300",
        paddingClass,
        alignClass
      )}
    >
      {/* 左上角大双引号 - 改用 Lucide 精细线条图标 */}
      {c.showQuotes !== false && (
        <QuoteIcon
          size={quoteIconSize}
          strokeWidth={quoteIconStroke}
          className={cn(
            "absolute left-3 top-3 pointer-events-none transform -scale-y-100 -scale-x-100",
            quoteColorClass
          )}
          style={customHex ? { color: customHex, opacity: 0.12 } : {}}
        />
      )}

      {/* 内容切换动画包装 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={text}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.16, ease: "easeInOut" }}
          className={cn("w-full flex flex-col z-10", alignClass)}
        >
          {/* 语录文本主体 */}
          <div
            className={cn(
              "font-medium leading-relaxed max-w-[85%] break-words transition-colors duration-200",
              fontColorClass
            )}
            style={{
              fontSize: `${baseFontSize}px`,
              ...fontColorStyle,
            }}
          >
            {loading && text === "" ? "正在加载一言..." : text}
          </div>

          {/* 来源作者标注 */}
          {c.showAuthor !== false && (author || from) && (
            <div
              className={cn(
                "text-[var(--color-text-secondary)] font-light break-all select-none pointer-events-none whitespace-nowrap overflow-hidden text-ellipsis max-w-[85%]",
                authorMarginClass
              )}
              style={{
                fontSize: `${baseFontSize * 0.65}px`,
              }}
            >
              {author && from ? (
                <span>—— {author} 《{from}》</span>
              ) : author ? (
                <span>—— {author}</span>
              ) : (
                <span>—— 《{from}》</span>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* 右下角大双引号 - 改用 Lucide 精细线条图标 */}
      {c.showQuotes !== false && (
        <QuoteIcon
          size={quoteIconSize}
          strokeWidth={quoteIconStroke}
          className={cn(
            "absolute right-3 bottom-3 pointer-events-none",
            quoteColorClass
          )}
          style={customHex ? { color: customHex, opacity: 0.12 } : {}}
        />
      )}
    </motion.div>
  );
}
