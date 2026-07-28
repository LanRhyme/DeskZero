import { useEffect, useState } from "react";

/**
 * 临时调试组件：显示当前焦点元素和键盘事件状态
 * TODO: 问题修复后删除此文件
 */
export function DebugOverlay() {
	const [activeEl, setActiveEl] = useState("");
	const [lastKeyEvent, setLastKeyEvent] = useState("");
	const [keyCount, setKeyCount] = useState(0);
	const [focusHistory, setFocusHistory] = useState<string[]>([]);

	useEffect(() => {
		const handleFocusIn = (e: FocusEvent) => {
			const target = e.target as HTMLElement | null;
			if (target) {
				const info = `${target.tagName}${target.id ? "#" + target.id : ""}${target.className ? "." + target.className.slice(0, 60) : ""}${target.getAttribute("contenteditable") ? " [contentEditable]" : ""}`;
				setActiveEl(info);
				setFocusHistory((prev) => [info, ...prev].slice(0, 10));
			}
		};

		const handleFocusOut = (e: FocusEvent) => {
			const target = e.target as HTMLElement | null;
			if (target) {
				console.log("🔴 [DBG] focusout:", target.tagName);
			}
		};

		const handleKeyDown = (e: KeyboardEvent) => {
			console.log(`⌨️ [DBG] keydown: key="${e.key}", code="${e.code}", ctrl=${e.ctrlKey}, target=${(e.target as HTMLElement).tagName}, activeEl=${document.activeElement?.tagName}`);
			setLastKeyEvent(`key="${e.key}" target=${(e.target as HTMLElement).tagName}`);
			setKeyCount((c) => c + 1);
		};

		const handlePointerDown = (e: PointerEvent) => {
			const target = e.target as HTMLElement;
			console.log(`🖱️ [DBG] pointerdown: target=${target.tagName}, className="${target.className.slice(0, 80)}"`);
		};

		document.addEventListener("focusin", handleFocusIn);
		document.addEventListener("focusout", handleFocusOut);
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("pointerdown", handlePointerDown);

		return () => {
			document.removeEventListener("focusin", handleFocusIn);
			document.removeEventListener("focusout", handleFocusOut);
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("pointerdown", handlePointerDown);
		};
	}, []);

	return (
		<div
			style={{
				position: "fixed",
				bottom: 0,
				left: 0,
				zIndex: 99999,
				background: "rgba(0,0,0,0.85)",
				color: "#0f0",
				fontFamily: "monospace",
				fontSize: "11px",
				padding: "8px 12px",
				maxWidth: "100vw",
				maxHeight: "200px",
				overflow: "auto",
				pointerEvents: "none",
			}}
		>
			<div style={{ display: "flex", gap: 16, marginBottom: 4 }}>
				<span>键盘事件: {keyCount}</span>
				<span>最后: {lastKeyEvent || "(无)"}</span>
			</div>
			<div style={{ color: "#ff0", marginBottom: 4 }}>
				activeElement: {activeEl || "(无)"}
			</div>
			<div style={{ fontSize: 10, opacity: 0.7 }}>
				{focusHistory.map((h, i) => (
					<div key={i}>{h}</div>
				))}
			</div>
		</div>
	);
}
