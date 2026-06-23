import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { type RefObject, useEffect, useRef, useState } from "react";
import { useDesktopStore } from "@/stores/desktopStore";
import { useMonitorStore } from "@/stores/monitorStore";

interface Position {
	x: number;
	y: number;
}

interface DragOptions {
	onDragEnd?: (pos: Position, clientX: number, clientY: number) => void;
	onDragStart?: () => void;
	onDrag?: (dx: number, dy: number) => void;
	disabled?: boolean;
	dragHandleRef?: RefObject<HTMLElement | null>;
	clampToBounds?: boolean;
	nativeDragItemPaths?: string[];
	nativeDragIconPath?: string;
}

export function useDrag(initialPos: Position, options?: DragOptions) {
	const [dragPos, setDragPos] = useState<Position | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	const dragInfo = useRef({
		startX: 0,
		startY: 0,
		elemStartX: 0,
		elemStartY: 0,
		dragging: false,
		hasMoved: false,
	});

	const pos =
		(dragInfo.current.dragging || isDragging) && dragPos ? dragPos : initialPos;

	// Use a ref for current position so onPointerUp always has latest value
	const currentPos = useRef<Position>(pos);
	currentPos.current = pos;

	const lastPointerDownTime = useRef<number>(0);

	// 安全重置拖拽状态（防止指针事件丢失导致卡死）
	const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const clearSafetyTimer = () => {
		if (safetyTimerRef.current) {
			clearTimeout(safetyTimerRef.current);
			safetyTimerRef.current = null;
		}
	};

	const resetDragState = () => {
		dragInfo.current.dragging = false;
		dragInfo.current.hasMoved = false;
		setIsDragging(false);
		useDesktopStore.getState().setIsGlobalDragging(false);
		setDragPos(null);
		clearSafetyTimer();
	};

	useEffect(() => {
		return () => clearSafetyTimer();
	}, []);

	const onPointerDown = (e: React.PointerEvent) => {
		if (options?.disabled) return;
		if (e.button !== 0) return; // Only left click

		// If dragHandleRef is provided, only allow dragging from that handle
		if (options?.dragHandleRef?.current) {
			if (!options.dragHandleRef.current.contains(e.target as Node)) {
				return;
			}
		}

		// 跳过可交互元素（textarea、input、contenteditable），不触发拖拽
		const target = e.target as HTMLElement;
		if (
			target.tagName === "TEXTAREA" ||
			target.tagName === "INPUT" ||
			target.isContentEditable
		) {
			return;
		}

		// 检测双击：如果两次按下时间间隔小于300ms，则判定为双击，不启动拖拽并放行事件
		const now = Date.now();
		const isDoubleClick = now - lastPointerDownTime.current < 300;
		lastPointerDownTime.current = now;

		if (isDoubleClick) {
			resetDragState();
			return;
		}

		dragInfo.current = {
			startX: e.clientX,
			startY: e.clientY,
			elemStartX: currentPos.current.x,
			elemStartY: currentPos.current.y,
			dragging: true,
			hasMoved: false,
		};

		// 捕获指针，确保鼠标移出元素后仍能收到 pointermove 事件
		(e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);

		// 安全定时器：如果 5 秒内没有收到 pointerup，自动重置状态
		clearSafetyTimer();
		safetyTimerRef.current = setTimeout(() => {
			if (dragInfo.current.dragging) {
				console.warn("[useDrag] Safety timeout: resetting stuck drag state");
				resetDragState();
			}
		}, 5000);
	};

	const onPointerMove = (e: React.PointerEvent) => {
		if (!dragInfo.current.dragging) return;

		const dx = e.clientX - dragInfo.current.startX;
		const dy = e.clientY - dragInfo.current.startY;

		// 只有在鼠标移动超过 3 像素时才确认是拖拽，以区分点击
		if (!dragInfo.current.hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
			dragInfo.current.hasMoved = true;
			setIsDragging(true);
			useDesktopStore.getState().setIsGlobalDragging(true);
			options?.onDragStart?.();
		}

		if (!dragInfo.current.hasMoved) return;

		let nextX = dragInfo.current.elemStartX + dx;
		let nextY = dragInfo.current.elemStartY + dy;

		// 限制范围在屏幕工作区域内（排除任务栏）
		if (options?.clampToBounds !== false) {
			const monitors = useMonitorStore.getState().monitors;
			const primary = monitors.find((m) => m.isPrimary) ?? monitors[0];
			const workArea = primary?.workArea;
			const maxX = workArea ? workArea.x + workArea.width : window.innerWidth;
			const maxY = workArea ? workArea.y + workArea.height : window.innerHeight;
			nextX = Math.max(0, Math.min(nextX, maxX - 80));
			nextY = Math.max(0, Math.min(nextY, maxY - 96));
		}

		setDragPos({ x: nextX, y: nextY });

		// 同步触发外部 onDrag 回调
		options?.onDrag?.(dx, dy);

		// 边缘触发原生拖拽（拖出窗口外到资源管理器）
		if (
			options?.nativeDragItemPaths &&
			options.nativeDragItemPaths.length > 0
		) {
			const threshold = 10;
			const monitors = useMonitorStore.getState().monitors;
			const primary = monitors.find((m) => m.isPrimary) ?? monitors[0];
			const workArea = primary?.workArea;
			const edgeX = workArea ? workArea.x + workArea.width : window.innerWidth;
			const edgeY = workArea ? workArea.y + workArea.height : window.innerHeight;
			if (
				e.clientX < threshold ||
				e.clientY < threshold ||
				e.clientX > edgeX - threshold ||
				e.clientY > edgeY - threshold
			) {
				resetDragState();

				const iconPath = options.nativeDragIconPath || "";
				startDrag({
					item: options.nativeDragItemPaths!,
					icon: iconPath,
					mode: "copy",
				}).catch((err) => {
					console.error("[DeskZero] Native drag failed:", err);
				});

				return;
			}
		}
	};

	const onPointerUp = (e: React.PointerEvent) => {
		if (!dragInfo.current.dragging) return;

		clearSafetyTimer();

		// 释放指针捕获
		(e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);

		const hasMoved = dragInfo.current.hasMoved;
		dragInfo.current.dragging = false;
		setIsDragging(false);
		useDesktopStore.getState().setIsGlobalDragging(false);

		if (hasMoved) {
			// 使用 ref 的最新位置，而不是已经过时的 React state
			options?.onDragEnd?.(currentPos.current, e.clientX, e.clientY);
			options?.onDrag?.(0, 0);
		}
		setDragPos(null);
	};

	const onClickCapture = (e: React.MouseEvent) => {
		if (dragInfo.current.hasMoved) {
			e.stopPropagation();
			e.preventDefault();
		}
		// 无论是否拦截，都重置标记
		dragInfo.current.hasMoved = false;
	};

	return {
		ref,
		pos,
		isDragging,
		listeners: {
			onPointerDown,
			onPointerMove,
			onPointerUp,
			onPointerCancel: onPointerUp,
			onClickCapture,
		},
	};
}
