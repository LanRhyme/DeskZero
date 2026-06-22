import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { type RefObject, useRef, useState } from "react";
import { useDesktopStore } from "@/stores/desktopStore";

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

	const activeCaptureElem = useRef<HTMLElement | null>(null);

	const pos =
		(dragInfo.current.dragging || isDragging) && dragPos ? dragPos : initialPos;

	// Use a ref for current position so onPointerUp always has latest value
	const currentPos = useRef<Position>(pos);
	currentPos.current = pos;

	const lastPointerDownTime = useRef<number>(0);

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
			dragInfo.current.dragging = false;
			dragInfo.current.hasMoved = false;
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

		// 同步设置指针捕获到绑定监听器的元素，确保即使鼠标快速移出元素仍能捕获 move/up 事件
		const captureElem = e.currentTarget as HTMLElement;
		activeCaptureElem.current = captureElem;
		try {
			captureElem.setPointerCapture(e.pointerId);
		} catch (err) {
			console.warn("[useDrag] SetPointerCapture failed in onPointerDown:", err);
		}
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

		// 限制范围在屏幕边界内（如果 clampToBounds 不为 false）
		if (options?.clampToBounds !== false) {
			nextX = Math.max(0, Math.min(nextX, window.innerWidth - 80));
			nextY = Math.max(0, Math.min(nextY, window.innerHeight - 96));
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
			if (
				e.clientX < threshold ||
				e.clientY < threshold ||
				e.clientX > window.innerWidth - threshold ||
				e.clientY > window.innerHeight - threshold
			) {
				dragInfo.current.dragging = false;
				setIsDragging(false);
				useDesktopStore.getState().setIsGlobalDragging(false);
				options?.onDrag?.(0, 0);

				try {
					if (
						activeCaptureElem.current &&
						activeCaptureElem.current.hasPointerCapture(e.pointerId)
					) {
						activeCaptureElem.current.releasePointerCapture(e.pointerId);
					}
				} catch (err) {
					console.warn(err);
				}
				activeCaptureElem.current = null;

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

		try {
			if (
				activeCaptureElem.current &&
				activeCaptureElem.current.hasPointerCapture(e.pointerId)
			) {
				activeCaptureElem.current.releasePointerCapture(e.pointerId);
			}
		} catch (err) {
			console.warn(err);
		}
		activeCaptureElem.current = null;

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
			dragInfo.current.hasMoved = false;
		}
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

