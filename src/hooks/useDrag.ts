import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { type RefObject, useRef, useState } from "react";

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

	const rafId = useRef<number | null>(null);
	const latestOffset = useRef<Position | null>(null);

	const pos =
		(dragInfo.current.dragging || isDragging) && dragPos ? dragPos : initialPos;

	// Use a ref for current position so onPointerUp always has latest value
	const currentPos = useRef<Position>(pos);
	currentPos.current = pos;

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

		e.stopPropagation();
		const elem = e.currentTarget as HTMLElement;
		elem.setPointerCapture(e.pointerId);

		dragInfo.current = {
			startX: e.clientX,
			startY: e.clientY,
			elemStartX: currentPos.current.x,
			elemStartY: currentPos.current.y,
			dragging: true,
			hasMoved: false,
		};
	};

	const onPointerMove = (e: React.PointerEvent) => {
		if (!dragInfo.current.dragging) return;

		const dx = e.clientX - dragInfo.current.startX;
		const dy = e.clientY - dragInfo.current.startY;

		// Only set isDragging true if moved more than a few pixels to distinguish from click
		if (!dragInfo.current.hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
			dragInfo.current.hasMoved = true;
			setIsDragging(true);
			options?.onDragStart?.();
		}

		if (dragInfo.current.hasMoved) {
			let nextX = dragInfo.current.elemStartX + dx;
			let nextY = dragInfo.current.elemStartY + dy;

			// Constrain to screen bounds if clampToBounds is true (default true)
			if (options?.clampToBounds !== false) {
				nextX = Math.max(0, Math.min(nextX, window.innerWidth - 80));
				nextY = Math.max(0, Math.min(nextY, window.innerHeight - 96));
			}

			const newPos = {
				x: nextX,
				y: nextY,
			};
			setDragPos(newPos);

			latestOffset.current = { x: dx, y: dy };
			if (rafId.current === null) {
				rafId.current = requestAnimationFrame(() => {
					rafId.current = null;
					if (latestOffset.current) {
						options?.onDrag?.(latestOffset.current.x, latestOffset.current.y);
					}
				});
			}

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
					if (rafId.current !== null) {
						cancelAnimationFrame(rafId.current);
						rafId.current = null;
					}
					latestOffset.current = null;
					options?.onDrag?.(0, 0);

					const target = e.currentTarget as HTMLElement;
					try {
						if (target.hasPointerCapture(e.pointerId)) {
							target.releasePointerCapture(e.pointerId);
						}
					} catch (e) {
						console.warn(e);
					}

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
		}
	};

	const onPointerUp = (e: React.PointerEvent) => {
		if (!dragInfo.current.dragging) return;

		const target = e.currentTarget as HTMLElement;
		if (target.hasPointerCapture(e.pointerId)) {
			target.releasePointerCapture(e.pointerId);
		}

		const hasMoved = dragInfo.current.hasMoved;
		dragInfo.current.dragging = false;
		setIsDragging(false);

		if (rafId.current !== null) {
			cancelAnimationFrame(rafId.current);
			rafId.current = null;
		}
		latestOffset.current = null;

		if (hasMoved) {
			// Use ref for latest position, not stale React state
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
