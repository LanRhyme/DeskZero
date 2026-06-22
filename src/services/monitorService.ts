import { invoke } from "@tauri-apps/api/core";
import type { Monitor } from "@/types/monitor";

export async function getMonitors(): Promise<Monitor[]> {
	return invoke("get_monitors");
}

export async function refreshMonitors(): Promise<Monitor[]> {
	return invoke("refresh_monitors");
}

export async function getMonitorForPoint(
	x: number,
	y: number,
): Promise<Monitor | null> {
	return invoke("get_monitor_for_point", { x, y });
}
