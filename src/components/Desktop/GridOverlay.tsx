import { useEffect } from "react";
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

	useEffect(() => {
		if (!isGlobalDragging) return;

		const handlePointerMove = (e: PointerEvent) => {
			mouseX.set(e.clientX);
			mouseY.set(e.clientY);
		};

		// 初始化鼠标位置
		const lastEvent = window.event as PointerEvent | undefined;
		if (lastEvent?.clientX) {
			mouseX.set(lastEvent.clientX);
			mouseY.set(lastEvent.clientY);
		}

		window.addEventListener("pointermove", handlePointerMove);
		return () => window.removeEventListener("pointermove", handlePointerMove);
	}, [isGlobalDragging, mouseX, mouseY]);

	if (!settings.gridEnabled || settings.showGridOnDrag === false) {
		return null;
	}

	// 网格参数
	const gw = settings.gridWidth || 80;
	const gh = settings.gridHeight || 104;
	const gx = settings.gridGapX ?? 20;
	const gy = settings.gridGapY ?? 20;

	const stepX = gw + gx;
	const stepY = gh + gy;
	const gridPadding = 10;

	// 屏幕尺寸，生成足够多的线条覆盖整个屏幕
	const screenW = window.innerWidth;
	const screenH = window.innerHeight;
	const colCount = Math.ceil((screenW - gridPadding) / stepX) + 1;
	const rowCount = Math.ceil((screenH - gridPadding) / stepY) + 1;

	// 生成主网格线条位置（槽位边界）
	const verticalLines: number[] = [];
	const horizontalLines: number[] = [];

	for (let i = 0; i <= colCount; i++) {
		// 左边界线
		verticalLines.push(gridPadding + i * stepX);
		// 右边界线（左边界 + 格子宽度）
		verticalLines.push(gridPadding + i * stepX + gw);
	}
	for (let j = 0; j <= rowCount; j++) {
		horizontalLines.push(gridPadding + j * stepY);
		horizontalLines.push(gridPadding + j * stepY + gh);
	}

	// 半网格线条位置（格子中心线）
	const halfVerticalLines: number[] = [];
	const halfHorizontalLines: number[] = [];

	for (let i = 0; i <= colCount; i++) {
		halfVerticalLines.push(gridPadding + i * stepX + gw / 2);
	}
	for (let j = 0; j <= rowCount; j++) {
		halfHorizontalLines.push(gridPadding + j * stepY + gh / 2);
	}

	// 径向渐变遮罩
	const maskImage = useMotionTemplate`radial-gradient(circle 350px at ${smoothX}px ${smoothY}px, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)`;

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
