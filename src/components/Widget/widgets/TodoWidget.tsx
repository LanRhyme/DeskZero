import i18next from "i18next";
import { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Circle, CircleCheckBig, Trash2, ListTodo, Calendar as CalendarIcon, Flag } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import type { WidgetComponentProps } from "@/types/widget";
import { cn } from "@/utils/cn";

interface TodoItemData {
  id: string;
  containerId: string;
  text: string;
  completed: boolean;
  priority: string;
  dueDate: string | null;
  orderIndex: number;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

const PRIORITY_LABELS: Record<string, string> = {
  high: i18next.t("widget.todo.priority.high"),
  medium: i18next.t("widget.todo.priority.medium"),
  low: i18next.t("widget.todo.priority.low"),
};

function generateId(): string {
  return "todo-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function TodoWidget({
  config,
  height,
  containerId,
  setIsEditing,
}: WidgetComponentProps) {
  const c = config.config;
  const { t } = useTranslation();
  const sortOrder = c.sortOrder || "completed-last";
  const fontSizeScale = c.fontSizeScale ?? 1.0;
  const showPriority = c.showPriority !== false;
  const showDueDate = c.showDueDate !== false;
  const fontColor = c.fontColor || "theme";

  const [items, setItems] = useState<TodoItemData[]>([]);
  const [newText, setNewText] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchItems = async () => {
    try {
      const data = await invoke<TodoItemData[]>("get_todo_items", { containerId });
      setItems(data);
    } catch (e) {
      console.error("获取待办数据失败:", e);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [containerId]);

  // 排序
  const sortedItems = useMemo(() => {
    const sorted = [...items];
    switch (sortOrder) {
      case "priority":
        const pOrder = { high: 0, medium: 1, low: 2 };
        sorted.sort((a, b) => (pOrder[a.priority as keyof typeof pOrder] ?? 1) - (pOrder[b.priority as keyof typeof pOrder] ?? 1));
        break;
      case "dueDate":
        sorted.sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        });
        break;
      case "completed-last":
        sorted.sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          return a.orderIndex - b.orderIndex;
        });
        break;
      default:
        sorted.sort((a, b) => a.orderIndex - b.orderIndex);
    }
    return sorted;
  }, [items, sortOrder]);

  const handleAdd = async () => {
    const text = newText.trim();
    if (!text) return;

    const newItem: TodoItemData = {
      id: generateId(),
      containerId,
      text,
      completed: false,
      priority: newPriority,
      dueDate: newDueDate || null,
      orderIndex: items.length,
    };

    try {
      await invoke("add_todo_item", { item: newItem });
      setItems([...items, newItem]);
      setNewText("");
      setNewPriority("medium");
      setNewDueDate("");
    } catch (e) {
      console.error("添加待办失败:", e);
    }
  };

  const handleToggle = async (item: TodoItemData) => {
    const updated = { ...item, completed: !item.completed };
    try {
      await invoke("update_todo_item", { item: updated });
      setItems(items.map((i) => (i.id === item.id ? updated : i)));
    } catch (e) {
      console.error("更新待办失败:", e);
    }
  };

  const handlePriorityChange = async (item: TodoItemData, newPri: string) => {
    const updated = { ...item, priority: newPri };
    try {
      await invoke("update_todo_item", { item: updated });
      setItems(items.map((i) => (i.id === item.id ? updated : i)));
    } catch (e) {
      console.error("更新优先级失败:", e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete_todo_item", { id });
      setItems(items.filter((i) => i.id !== id));
    } catch (e) {
      console.error("删除待办失败:", e);
    }
  };

  // 字体大小
  const isCompact = height <= 150;
  const baseFontSize = Math.max(10, Math.min(16, (isCompact ? 10 : 12) * fontSizeScale));

  // 文字颜色
  const fontColorClass = cn(
    fontColor === "theme" && "text-[var(--color-text)]",
    fontColor === "accent" && "text-[var(--color-accent)]"
  );
  const fontColorStyle: React.CSSProperties = fontColor.startsWith("#") ? { color: fontColor } : {};

  const completedRatio = items.length > 0 ? items.filter((i) => i.completed).length / items.length : 0;

  return (
    <div className="w-full h-full flex flex-col select-none">
      {/* 头部统计 */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-1.5">
          <ListTodo size={isCompact ? 14 : 16} className="text-[var(--color-text-secondary)]" strokeWidth={1.5} />
          <span className={cn("font-medium", fontColorClass)} style={{ fontSize: `${baseFontSize}px`, ...fontColorStyle }}>
            {t("widget.todo.title")}
          </span>
        </div>
        <span className="text-[var(--color-text-secondary)]" style={{ fontSize: `${baseFontSize * 0.75}px` }}>
          {items.filter((i) => i.completed).length}/{items.length}
        </span>
      </div>

      {/* 进度条 */}
      <div className="mx-3 h-0.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-[var(--color-accent)] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${completedRatio * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* 待办列表 */}
      <div className="flex-1 overflow-y-auto hidden-native-scrollbar px-2 py-1.5 space-y-0.5">
        <AnimatePresence>
          {sortedItems.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8, height: 0 }}
              transition={{ delay: i * 0.03 }}
              className="group flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors"
            >
              {/* 优先级色条（可点击切换） */}
              {showPriority && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const prios = ["high", "medium", "low"];
                    const idx = prios.indexOf(item.priority);
                    handlePriorityChange(item, prios[(idx + 1) % 3]);
                  }}
                  className="w-1 self-stretch rounded-full flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium }}
                  title={t("widget.todo.priorityTooltip", { level: PRIORITY_LABELS[item.priority] || t("widget.todo.priority.medium") })}
                />
              )}

              {/* 完成圆圈 */}
              <button onClick={() => handleToggle(item)} className="flex-shrink-0 transition-colors">
                {item.completed ? (
                  <CircleCheckBig size={isCompact ? 14 : 16} className="text-[var(--color-accent)]" strokeWidth={1.8} />
                ) : (
                  <Circle size={isCompact ? 14 : 16} className="text-[var(--color-text)] opacity-30 hover:opacity-60" strokeWidth={1.5} />
                )}
              </button>

              {/* 文本 */}
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "truncate transition-all",
                    item.completed ? "line-through opacity-40" : "",
                    fontColorClass
                  )}
                  style={{ fontSize: `${baseFontSize}px`, ...fontColorStyle }}
                >
                  {item.text}
                </div>
                <div className="flex items-center gap-1.5">
                  {showDueDate && item.dueDate && (
                    <span className="text-[var(--color-text-secondary)] truncate inline-flex items-center gap-0.5" style={{ fontSize: `${baseFontSize * 0.65}px` }}>
                      <CalendarIcon size={8} strokeWidth={1.5} />
                      {item.dueDate}
                    </span>
                  )}
                  {showPriority && (
                    <span
                      className="inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-60 transition-opacity"
                      style={{ fontSize: `${baseFontSize * 0.6}px`, color: PRIORITY_COLORS[item.priority] }}
                    >
                      <Flag size={7} strokeWidth={2} />
                      {PRIORITY_LABELS[item.priority] || "中"}
                    </span>
                  )}
                </div>
              </div>

              {/* 删除按钮 */}
              <button
                onClick={() => handleDelete(item.id)}
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-secondary)] hover:text-red-500"
              >
                <Trash2 size={isCompact ? 12 : 14} strokeWidth={1.5} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 添加区域 */}
      <div className="px-3 pb-2.5 pt-1 border-t border-black/5 dark:border-white/5">
        {/* 展开的添加表单 */}
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-2 space-y-1.5 overflow-hidden"
          >
            {/* 优先级选择 */}
            <div className="flex items-center gap-1">
              <Flag size={10} className="text-[var(--color-text-secondary)]" strokeWidth={1.5} />
              <span className="text-[var(--color-text-secondary)]" style={{ fontSize: `${baseFontSize * 0.7}px` }}>{t("widget.todo.priorityLabel")}</span>
              {["high", "medium", "low"].map((p) => (
                <button
                  key={p}
                  onClick={() => setNewPriority(p)}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] transition-all",
                    newPriority === p
                      ? "text-white shadow-sm"
                      : "bg-black/5 dark:bg-white/5 text-[var(--color-text-secondary)] hover:bg-black/10 dark:hover:bg-white/10"
                  )}
                  style={newPriority === p ? { backgroundColor: PRIORITY_COLORS[p] } : {}}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>

            {/* 截止日期 */}
            <div className="flex items-center gap-1">
              <CalendarIcon size={10} className="text-[var(--color-text-secondary)]" strokeWidth={1.5} />
              <span className="text-[var(--color-text-secondary)]" style={{ fontSize: `${baseFontSize * 0.7}px` }}>{t("widget.todo.dueDateLabel")}</span>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="flex-1 bg-black/5 dark:bg-white/5 rounded px-1.5 py-0.5 text-[10px] text-[var(--color-text)] outline-none border border-transparent focus:border-[var(--color-accent)]/30 select-text"
                style={{ colorScheme: "dark" }}
              />
              {newDueDate && (
                <button onClick={() => setNewDueDate("")} className="text-[var(--color-text-secondary)] hover:text-red-400 text-[10px]">{t("common.cleared")}</button>
              )}
            </div>
          </motion.div>
        )}

        {/* 输入行 */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={cn(
              "flex-shrink-0 p-0.5 rounded transition-colors",
              showAddForm ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]" : "text-[var(--color-text-secondary)]"
            )}
          >
            <Plus size={isCompact ? 14 : 16} strokeWidth={1.5} className={cn(showAddForm && "rotate-45 transition-transform")} />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") { setShowAddForm(false); setNewText(""); }
            }}
            onFocus={() => setIsEditing?.(true)}
            onBlur={() => setIsEditing?.(false)}
            placeholder={t("widget.todo.addPlaceholder")}
            className="flex-1 bg-transparent outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] placeholder:opacity-40 select-text"
            style={{ fontSize: `${baseFontSize}px` }}
          />
          {(newText.trim() || showAddForm) && (
            <button
              onClick={handleAdd}
              className="flex-shrink-0 px-1.5 py-0.5 rounded bg-[var(--color-accent)] text-white text-[10px] hover:opacity-90 transition-opacity"
            >
              {t("widget.todo.addBtn")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
