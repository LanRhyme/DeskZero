import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import type { IconSize, ItemBackground, Theme } from "@/types/settings";
import { CustomSelect } from "@/components/UI/CustomSelect";
import { SwitchToggle } from "@/components/UI/SwitchToggle";
import { Slider } from "@/components/UI/Slider";

interface Props {
	onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
	const { t } = useTranslation();
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
				<h2 className="text-lg font-semibold mb-4">{t("settingsPanel.title")}</h2>

				<div className="space-y-4">
					<div>
						<label className="text-sm font-medium block mb-1">{t("settingsPanel.theme")}</label>
						<CustomSelect
							value={settings.theme}
							onChange={(v) => saveSettings({ theme: v as Theme })}
							options={[
								{ value: "light", label: t("settingsPanel.light") },
								{ value: "dark", label: t("settingsPanel.dark") },
								{ value: "system", label: t("settingsPanel.system") },
							]}
						/>
					</div>

					<div>
						<label className="text-sm font-medium block mb-1">{t("settingsPanel.iconSize")}</label>
						<CustomSelect
							value={settings.iconSize}
							onChange={(v) => saveSettings({ iconSize: v as IconSize })}
							options={[
								{ value: "small", label: t("settingsPanel.small") },
								{ value: "medium", label: t("settingsPanel.medium") },
								{ value: "large", label: t("settingsPanel.large") },
							]}
						/>
					</div>

					<div>
						<label className="text-sm font-medium block mb-1">{t("settingsPanel.itemBg")}</label>
						<CustomSelect
							value={settings.itemBackground}
							onChange={(v) => saveSettings({ itemBackground: v as ItemBackground })}
							options={[
								{ value: "transparent", label: t("settingsPanel.transparent") },
								{ value: "subtle", label: t("settingsPanel.subtle") },
								{ value: "visible", label: t("settingsPanel.visible") },
							]}
						/>
					</div>

					<div>
						<label className="text-sm font-medium block mb-1">{t("settingsPanel.gridAlign")}</label>
						<div className="flex items-center gap-2">
							<SwitchToggle
								checked={settings.gridEnabled}
								onChange={(checked) => saveSettings({ gridEnabled: checked })}
							/>
							<span className="text-sm">{t("common.enabled")}</span>
						</div>
					</div>

					<div>
						<label className="text-sm font-medium block mb-1">{t("settingsPanel.gridWidth")}</label>
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
						<label className="text-sm font-medium block mb-1">{t("settingsPanel.gridHeight")}</label>
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
					{t("settingsPanel.close")}
				</button>
			</div>
		</div>
	);
}
