import { useSettingsStore } from "@/stores/settingsStore";
import type { IconSize, ItemBackground, Theme } from "@/types/settings";
import { CustomSelect } from "@/components/UI/CustomSelect";
import { SwitchToggle } from "@/components/UI/SwitchToggle";
import { Slider } from "@/components/UI/Slider";

interface Props {
	onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
	const { settings, saveSettings } = useSettingsStore();

	return (
		<div
			className="fixed inset-0 z-40 flex items-center justify-center"
			style={{ background: "rgba(0,0,0,0.3)" }}
			onClick={onClose}
		>
			<div
				className="w-96 max-h-[80vh] overflow-y-auto rounded-xl p-6"
				style={{
					background: "var(--color-bg)",
					border: "1px solid var(--color-border)",
					backdropFilter: "var(--container-blur)",
					color: "var(--color-text)",
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<h2 className="text-lg font-semibold mb-4">设置</h2>

				<div className="space-y-4">
					<div>
						<label className="text-sm font-medium block mb-1">主题</label>
						<CustomSelect
							value={settings.theme}
							onChange={(v) => saveSettings({ theme: v as Theme })}
							options={[
								{ value: "light", label: "浅色" },
								{ value: "dark", label: "深色" },
								{ value: "system", label: "跟随系统" },
							]}
						/>
					</div>

					<div>
						<label className="text-sm font-medium block mb-1">图标大小</label>
						<CustomSelect
							value={settings.iconSize}
							onChange={(v) => saveSettings({ iconSize: v as IconSize })}
							options={[
								{ value: "small", label: "小" },
								{ value: "medium", label: "中" },
								{ value: "large", label: "大" },
							]}
						/>
					</div>

					<div>
						<label className="text-sm font-medium block mb-1">Item 背景</label>
						<CustomSelect
							value={settings.itemBackground}
							onChange={(v) => saveSettings({ itemBackground: v as ItemBackground })}
							options={[
								{ value: "transparent", label: "透明" },
								{ value: "subtle", label: "浅色" },
								{ value: "visible", label: "可见" },
							]}
						/>
					</div>

					<div>
						<label className="text-sm font-medium block mb-1">网格对齐</label>
						<div className="flex items-center gap-2">
							<SwitchToggle
								checked={settings.gridEnabled}
								onChange={(checked) => saveSettings({ gridEnabled: checked })}
							/>
							<span className="text-sm">启用</span>
						</div>
					</div>

					<div>
						<label className="text-sm font-medium block mb-1">网格宽度</label>
						<Slider
							min={40}
							max={160}
							step={10}
							value={settings.gridWidth}
							onChange={(val) => saveSettings({ gridWidth: val })}
						/>
						<span
							className="text-xs"
							style={{ color: "var(--color-text-secondary)" }}
						>
							{settings.gridWidth}px
						</span>
					</div>

					<div>
						<label className="text-sm font-medium block mb-1">网格高度</label>
						<Slider
							min={40}
							max={160}
							step={10}
							value={settings.gridHeight}
							onChange={(val) => saveSettings({ gridHeight: val })}
						/>
						<span
							className="text-xs"
							style={{ color: "var(--color-text-secondary)" }}
						>
							{settings.gridHeight}px
						</span>
					</div>
				</div>

				<button
					className="mt-6 w-full rounded-md py-2 text-sm font-medium"
					style={{
						background: "var(--color-accent)",
						color: "white",
					}}
					onClick={onClose}
				>
					关闭
				</button>
			</div>
		</div>
	);
}
