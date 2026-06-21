export type Theme = "light" | "dark" | "system";
export type IconSize = "small" | "medium" | "large";
export type ItemBackground = "transparent" | "subtle" | "visible";
export type SelectedItemBackground = "white" | "black";

export interface Settings {
	theme: Theme;
	accentColor: string;
	gridEnabled: boolean;
	gridWidth: number;
	gridHeight: number;
	gridGapX: number;
	gridGapY: number;
	iconSize: IconSize;
	cornerRadius: number;
	backgroundBlur: boolean;
	wallpaperCompatible: boolean;
	itemBackground: ItemBackground;
	selectedItemBackground: SelectedItemBackground;
	selectedItemBlur: boolean;
	globalBlur: boolean;
	fontSize: number;
	hideShortcutBadge?: boolean;
	hideFileExtensions?: boolean;
	iconOpacity?: number;
	textOpacity?: number;
	iconGlow?: boolean;
	iconGlowRadius?: number;
	iconGlowIntensity?: number;
	doubleClickHide?: boolean;
	showGridOnDrag?: boolean;
	customWidgets?: any[];
}
