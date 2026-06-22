import type { Item } from "./item";

export type ContainerType = "normal" | "mapping" | "folder" | "game" | "iconShow" | "widget";

export interface Position {
	x: number;
	y: number;
}

export interface Size {
	width: number;
	height: number;
}

export interface ContainerStyle {
	backgroundOpacity: number;
	backgroundColor?: string;
	cornerRadius: number;
	showHeader: boolean;
	layout?: "grid" | "list";
	gridEnabled?: boolean;
	gridWidth?: number;
	gridHeight?: number;
	listHeight?: number;
	gridGapX?: number;
	gridGapY?: number;
	iconSize?: string;
	blurAmount?: number;
	backgroundType?: "default" | "acrylic" | "mica";
	showDetails?: boolean;
	hideAppNames?: boolean;
	coverImage?: string;
	sortBy?: string;
	sortDesc?: boolean;
	featherX?: number;
	featherY?: number;
	iconOpacityInside?: number;
	iconSizeInside?: number;
	hoverAnimation?: string;
	clickAnimation?: string;
	singleClickLaunch?: boolean;
	showNamesInside?: boolean;
	iconGapRatio?: number;
	collapsible?: boolean;
	collapsed?: boolean;
}

export interface Container {
	id: string;
	name: string;
	type: ContainerType;
	position: Position;
	size: Size;
	items: Item[];
	style: ContainerStyle;
	folderPath?: string;
	monitorId?: string;
	createdAt: number;
	updatedAt: number;
}
