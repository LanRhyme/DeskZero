import { invoke } from "@tauri-apps/api/core";
import type { Item } from "@/types/item";
import type { Settings } from "@/types/settings";
import type { Position } from "@/types/container";

export async function scanDesktopIcons(): Promise<Item[]> {
	return invoke("scan_desktop_icons");
}

export async function syncWindowsLayout(multiplier: number): Promise<[Settings, Record<string, Position>]> {
	return invoke("sync_windows_layout", { multiplier });
}
