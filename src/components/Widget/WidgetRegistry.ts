import type { WidgetRegistration, WidgetConfig } from "@/types/widget";
import { ClockWidget } from "./widgets/ClockWidget";
import { StickyNoteWidget } from "./widgets/StickyNoteWidget";
import { SystemMonitorWidget } from "./widgets/SystemMonitorWidget";

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
