import { useEffect, useMemo } from "react";
import { useDesktopStore } from "@/stores/desktopStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { motion, useMotionValue, useSpring, useMotionTemplate } from "framer-motion";

/**
 * 网格辅助线覆盖层
 * 拖拽/缩放时在鼠标周围显示网格线条，帮助精准对齐。
 */
export function GridOverlay() {
	const { settings } = useSettingsStore();
	const isGlobalDragging = useDesktopStore((state) => state.isGlobalDragging);

	const mouseX = useMotionValue(-1000);
	const mouseY = useMotionValue(-1000);

	const smoothX = useSpring(mouseX, { stiffness: 300, damping: 30 });
	const smoothY = useSpring(mouseY, { stiffness: 300, damping: 30 });

	// 径向渐变遮罩（必须在条件返回之前调用，遵循 Rules of Hooks）
	const maskImage = useMotionTemplate`radial-gradient(circle 350px at ${smoothX}px ${smoothY}px, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)`;

	useEffect(() => {
		if (!isGlobalDragging) return;

		const handlePointerMove = (e: PointerEvent) => {
			mouseX.set(e.clientX);
			mouseY.set(e.clientY);
		};

		window.addEventListener("pointermove", handlePointerMove);
		return () => window.removeEventListener("pointermove", handlePointerMove);
	}, [isGlobalDragging, mouseX, mouseY]);

	// 网格参数
	const gw = settings.gridWidth || 80;
	const gh = settings.gridHeight || 104;
	const gx = settings.gridGapX ?? 20;
	const gy = settings.gridGapY ?? 20;

	const stepX = gw + gx;
	const stepY = gh + gy;
	const gridPadding = 10;

	// 屏幕尺寸
	const screenW = window.innerWidth;
	const screenH = window.innerHeight;
	const colCount = Math.ceil((screenW - gridPadding) / stepX) + 1;
	const rowCount = Math.ceil((screenH - gridPadding) / stepY) + 1;

	// 生成网格线条位置（memoize 避免每次渲染重新计算）
	const { verticalLines, horizontalLines, halfVerticalLines, halfHorizontalLines } = useMemo(() => {
		const vLines: number[] = [];
		const hLines: number[] = [];
		const hvLines: number[] = [];
		const hhLines: number[] = [];

		for (let i = 0; i <= colCount; i++) {
			vLines.push(gridPadding + i * stepX);
			vLines.push(gridPadding + i * stepX + gw);
			hvLines.push(gridPadding + i * stepX + gw / 2);
		}
		for (let j = 0; j <= rowCount; j++) {
			hLines.push(gridPadding + j * stepY);
			hLines.push(gridPadding + j * stepY + gh);
			hhLines.push(gridPadding + j * stepY + gh / 2);
		}

		return { verticalLines: vLines, horizontalLines: hLines, halfVerticalLines: hvLines, halfHorizontalLines: hhLines };
	}, [colCount, rowCount, stepX, stepY, gw, gh, gridPadding]);

	if (!settings.gridEnabled || settings.showGridOnDrag === false) {
		return null;
	}

	return (
		<motion.div
			className="absolute inset-0 pointer-events-none z-[35] overflow-hidden"
			initial={{ opacity: 0 }}
			animate={{ opacity: isGlobalDragging ? 1 : 0 }}
			transition={{ duration: 0.25 }}
			style={{ maskImage, WebkitMaskImage: maskImage }}
		>
			<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
				{/* 半网格线 - 虚线，较浅 */}
				{halfVerticalLines.map((x, i) => (
					<line
						key={`hv-${i}`}
						x1={x} y1={0} x2={x} y2={screenH}
						stroke="var(--color-text)"
						strokeOpacity="0.12"
						strokeWidth="1"
						strokeDasharray="3 6"
					/>
				))}
				{halfHorizontalLines.map((y, i) => (
					<line
						key={`hh-${i}`}
						x1={0} y1={y} x2={screenW} y2={y}
						stroke="var(--color-text)"
						strokeOpacity="0.12"
						strokeWidth="1"
						strokeDasharray="3 6"
					/>
				))}

				{/* 主网格线 - 实线，清晰 */}
				{verticalLines.map((x, i) => (
					<line
						key={`v-${i}`}
						x1={x} y1={0} x2={x} y2={screenH}
						stroke="var(--color-text)"
						strokeOpacity="0.25"
						strokeWidth="1"
					/>
				))}
				{horizontalLines.map((y, i) => (
					<line
						key={`h-${i}`}
						x1={0} y1={y} x2={screenW} y2={y}
						stroke="var(--color-text)"
						strokeOpacity="0.25"
						strokeWidth="1"
					/>
				))}
			</svg>
		</motion.div>
	);
}
