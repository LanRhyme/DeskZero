import { invoke } from "@tauri-apps/api/core";
import type { Item } from "@/types/item";

export async function scanDesktopIcons(): Promise<Item[]> {
	return invoke("scan_desktop_icons");
}
