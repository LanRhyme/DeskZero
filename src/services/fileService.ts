import { invoke } from "@tauri-apps/api/core";

export async function openFile(path: string): Promise<void> {
	return invoke("open_file", { path });
}

export async function renameFile(
	path: string,
	newName: string,
): Promise<string> {
	return invoke("rename_file", { path, newName });
}

export async function deleteFile(path: string): Promise<void> {
	return invoke("delete_file", { path });
}

export async function moveFile(from: string, to: string): Promise<void> {
	return invoke("move_file", { from, to });
}
