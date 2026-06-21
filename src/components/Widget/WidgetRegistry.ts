import type { WidgetRegistration, WidgetConfig } from "@/types/widget";
import { ClockWidget } from "./widgets/ClockWidget";
import { StickyNoteWidget } from "./widgets/StickyNoteWidget";
import { SystemMonitorWidget } from "./widgets/SystemMonitorWidget";
import { HitokotoWidget } from "./widgets/HitokotoWidget";
import { CountdownWidget } from "./widgets/CountdownWidget";
import { TodoWidget } from "./widgets/TodoWidget";
import { CalendarWidget } from "./widgets/CalendarWidget";
import { WeatherWidget } from "./widgets/WeatherWidget";
import { MusicWidget } from "./widgets/MusicWidget";

const registry = new Map<string, WidgetRegistration>();

export function registerWidget(registration: WidgetRegistration) {
	registry.set(registration.widgetType, registration);
}

export function getWidget(widgetType: string): WidgetRegistration | undefined {
	return registry.get(widgetType);
}

export function getAllWidgets(): WidgetRegistration[] {
	return Array.from(registry.values());
}

export function getDefaultWidgetConfig(
	widgetType: string,
): WidgetConfig | undefined {
	const reg = registry.get(widgetType);
	return reg ? { ...reg.defaultConfig } : undefined;
}

// 注册内置小组件
registerWidget({
	widgetType: "clock",
	name: "时钟",
	icon: "Clock", // 由调用方通过 lucide 图标渲染
	defaultSize: { width: 2, height: 1 },
	defaultConfig: {
		widgetType: "clock",
		config: { clockStyle: "digital" },
	},
	component: ClockWidget,
});

registerWidget({
	widgetType: "stickyNote",
	name: "便签",
	icon: "StickyNote",
	defaultSize: { width: 2, height: 2 },
	defaultConfig: {
		widgetType: "stickyNote",
		config: { content: "", color: "#ffeb3b" },
	},
	component: StickyNoteWidget,
});

registerWidget({
	widgetType: "systemMonitor",
	name: "系统监控",
	icon: "Activity",
	defaultSize: { width: 3, height: 2 },
	defaultConfig: {
		widgetType: "systemMonitor",
		config: {
			refreshInterval: 2,
			showCpu: true,
			showMemory: true,
			showDisk: true,
		},
	},
	component: SystemMonitorWidget,
});

registerWidget({
	widgetType: "hitokoto",
	name: "一言",
	icon: "Quote",
	defaultSize: { width: 2, height: 1 },
	defaultConfig: {
		widgetType: "hitokoto",
		config: {
			category: "all",
			refreshInterval: 3600,
			fontColor: "theme",
			fontSizeScale: 1.0,
			textAlign: "center",
			showAuthor: true,
			showQuotes: true,
			clickAction: "refresh",
			customText: "",
			customAuthor: "",
			customFrom: "",
		},
	},
	component: HitokotoWidget,
});

registerWidget({
	widgetType: "countdown",
	name: "倒计日",
	icon: "Timer",
	defaultSize: { width: 2, height: 2 },
	defaultConfig: {
		widgetType: "countdown",
		config: {
			displayMode: "list",
			fontSizeScale: 1.0,
			fontColor: "theme",
			sortOrder: "date-asc",
		},
	},
	component: CountdownWidget,
});

registerWidget({
	widgetType: "todo",
	name: "待办事项",
	icon: "ListTodo",
	defaultSize: { width: 2, height: 3 },
	defaultConfig: {
		widgetType: "todo",
		config: {
			sortOrder: "completed-last",
			fontSizeScale: 1.0,
			showPriority: true,
			showDueDate: true,
			fontColor: "theme",
		},
	},
	component: TodoWidget,
});

registerWidget({
	widgetType: "calendar",
	name: "日历",
	icon: "CalendarDays",
	defaultSize: { width: 3, height: 3 },
	defaultConfig: {
		widgetType: "calendar",
		config: {
			showLunar: true,
			fontSizeScale: 1.0,
			fontColor: "theme",
			highlightToday: true,
			startOfWeek: "monday",
			showWeekNumber: false,
			showFestivals: true,
			festivalColor: "#ef4444",
		},
	},
	component: CalendarWidget,
});

registerWidget({
	widgetType: "weather",
	name: "天气",
	icon: "CloudSun",
	defaultSize: { width: 3, height: 1.5 },
	defaultConfig: {
		widgetType: "weather",
		config: {
			apiKey: "",
			location: "",
			fontSizeScale: 1.0,
			fontColor: "theme",
			showForecast: true,
			tempUnit: "celsius",
			showDetails: true,
		},
	},
	component: WeatherWidget,
});

registerWidget({
	widgetType: "music",
	name: "音乐",
	icon: "Music",
	defaultSize: { width: 3, height: 1.5 },
	defaultConfig: {
		widgetType: "music",
		config: {
			fontSizeScale: 1.0,
			fontColor: "theme",
			showAlbumArt: true,
			showProgress: true,
			compactMode: false,
		},
	},
	component: MusicWidget,
});

