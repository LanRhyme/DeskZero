import { useSettingsStore } from "@/stores/settingsStore";

export function getGridSize() {
	const settings = useSettingsStore.getState().settings;
	return {
		w: settings.gridWidth || 80,
		h: settings.gridHeight || 104,
		gapX: settings.gridGapX ?? 20,
		gapY: settings.gridGapY ?? 20,
	};
}

export function snapPosition(x: number, y: number, halfGrid: boolean = true) {
	const grid = getGridSize();
	const stepX = halfGrid ? (grid.w + grid.gapX) / 2 : grid.w + grid.gapX;
	const stepY = halfGrid ? (grid.h + grid.gapY) / 2 : grid.h + grid.gapY;
	
	const snappedX = Math.round((x - 10) / stepX) * stepX + 10;
	const snappedY = Math.round((y - 10) / stepY) * stepY + 10;
	return { x: Math.max(10, snappedX), y: Math.max(10, snappedY) };
}

export function snapSize(width: number, height: number, halfGrid: boolean = true) {
	const grid = getGridSize();
	const stepX = halfGrid ? (grid.w + grid.gapX) / 2 : grid.w + grid.gapX;
	const stepY = halfGrid ? (grid.h + grid.gapY) / 2 : grid.h + grid.gapY;
	
	const cols = Math.max(1, Math.round((width + grid.gapX) / stepX));
	const rows = Math.max(1, Math.round((height + grid.gapY) / stepY));
	
	const snappedWidth = cols * stepX - grid.gapX;
	const snappedHeight = rows * stepY - grid.gapY;
	return { width: snappedWidth, height: snappedHeight };
}
