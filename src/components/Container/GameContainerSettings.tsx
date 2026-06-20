import { useLayoutEffect, useRef } from "react";
import { NumberInput } from "@/components/UI/NumberInput";
import { SettingRow } from "@/components/UI/SettingRow";
import { Slider } from "@/components/UI/Slider";
import { TextInput } from "@/components/UI/TextInput";
import { useContainerStore } from "@/stores/containerStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Container as ContainerType } from "@/types/container";

interface GameContainerSettingsProps {
	container: ContainerType;
	onClose: () => void;
}

export function GameContainerSettings({
	container,
	onClose,
}: GameContainerSettingsProps) {
	const { updateContainerStyle, updateContainerSize } = useContainerStore();
	const { settings } = useSettingsStore();

	const gw = settings.gridWidth || 80;
	const gh = settings.gridHeight || 104;
	const gx = settings.gridGapX ?? 20;
	const gy = settings.gridGapY ?? 20;

	// Calculate current grid size
	const gridW = Math.max(1, Math.round(container.size.width / (gw + gx)));
	const gridH = Math.max(1, Math.round(container.size.height / (gh + gy)));

	const containerRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		if (containerRef.current) {
			const parent = containerRef.current.parentElement;
			if (parent) {
				const rect = containerRef.current.getBoundingClientRect();
				const padding = 10;

				const styleLeft = parseFloat(parent.style.left) || 0;
				const styleTop = parseFloat(parent.style.top) || 0;

				let newLeft = styleLeft;
				let newTop = styleTop;

				if (styleLeft + rect.width > window.innerWidth) {
					newLeft = Math.max(padding, window.innerWidth - rect.width - padding);
				}
				if (newLeft < padding) newLeft = padding;

				if (styleTop + rect.height > window.innerHeight) {
					newTop = Math.max(padding, window.innerHeight - rect.height - padding);
				}
				if (newTop < padding) newTop = padding;

				parent.style.left = `${newLeft}px`;
				parent.style.top = `${newTop}px`;
			}
		}
	});

	const updateSize = (w: number, h: number) => {
		updateContainerSize(container.id, {
			width: w * (gw + gx) - gx,
			height: h * (gh + gy) - gy,
		});
	};

	return (
		<div ref={containerRef} className="flex flex-col gap-3 text-sm">
			<SettingRow title="网格大小 (宽 x 高)" layout="vertical">
				<div className="flex gap-2 items-center">
					<NumberInput
						value={gridW}
						onChange={(val) => updateSize(val, gridH)}
						min={1}
						className="flex-1"
					/>
					<span className="text-[var(--color-text)] text-xs font-medium opacity-50">
						x
					</span>
					<NumberInput
						value={gridH}
						onChange={(val) => updateSize(gridW, val)}
						min={1}
						className="flex-1"
					/>
				</div>
			</SettingRow>

			<SettingRow title={`不透明度 (${Math.round((container.style.backgroundOpacity ?? 1) * 100)}%)`} layout="vertical">
				<Slider
					min={0}
					max={1}
					step={0.1}
					value={container.style.backgroundOpacity ?? 1}
					onChange={(val) =>
						updateContainerStyle(container.id, { backgroundOpacity: val })
					}
				/>
			</SettingRow>

			<SettingRow title={`圆角 (${container.style.cornerRadius ?? 16}px)`} layout="vertical">
				<Slider
					min={0}
					max={40}
					step={1}
					value={container.style.cornerRadius ?? 16}
					onChange={(val) =>
						updateContainerStyle(container.id, { cornerRadius: val })
					}
				/>
			</SettingRow>

			<SettingRow title="封面图片 (URL/路径)" layout="vertical">
				<TextInput
					placeholder="可输入自定义图片链接或本地路径"
					value={container.style.coverImage || ""}
					onChange={(val) =>
						updateContainerStyle(container.id, { coverImage: val })
					}
				/>
				<span className="text-[10px] text-[var(--color-text-secondary)]">
					自动获取失败时可手动设置，支持本地图片路径或网络链接。
				</span>
			</SettingRow>

			<div className="flex justify-end pt-1">
				<button
					onClick={onClose}
					className="px-3 py-1 text-xs bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent)] transition-colors"
				>
					完成
				</button>
			</div>
		</div>
	);
}
