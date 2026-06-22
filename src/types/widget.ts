import type { Size } from "./container";

export interface WidgetConfig {
	widgetType: string; // "clock" | "stickyNote" | "systemMonitor" | "custom"
	customHtmlPath?: string;
	config: Record<string, any>;
}

export interface WidgetMeta {
	name: string;
	defaultWidth: number; // 网格单位
	defaultHeight: number; // 网格单位
	configSchema?: ConfigField[];
}

export interface ConfigField {
	key: string;
	label: string;
	type: "text" | "number" | "color" | "select" | "toggle";
	default: any;
	options?: { label: string; value: any }[];
	min?: number;
	max?: number;
	step?: number;
}

export interface ThemeInfo {
	mode: "light" | "dark";
	accentColor: string;
	backgroundColor: string;
	textColor: string;
	borderColor: string;
	variables: Record<string, string>;
}

export interface WidgetRegistration {
	widgetType: string;
	name: string;
	icon: React.ReactNode;
	defaultSize: Size;
	defaultConfig: WidgetConfig;
	component: React.ComponentType<WidgetComponentProps>;
}

export interface WidgetComponentProps {
	config: WidgetConfig;
	onConfigChange: (config: WidgetConfig) => void;
	containerId: string;
	width: number;
	height: number;
	isEditing?: boolean;
	setIsEditing?: (editing: boolean) => void;
	backgroundOpacity?: number;
}

export interface WidgetToHostMessage {
	type: "ready" | "configChanged" | "invoke" | "showConfig";
	meta?: WidgetMeta;
	config?: Record<string, any>;
	id?: string;
	command?: string;
	args?: Record<string, any>;
}

export interface HostToWidgetMessage {
	type: "render" | "showConfig" | "destroy" | "invokeResult";
	config?: WidgetConfig;
	width?: number;
	height?: number;
	theme?: ThemeInfo;
	id?: string;
	result?: any;
	error?: string;
}
