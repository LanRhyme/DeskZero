import { useCallback, useEffect, useRef, useState } from "react";
import type { WidgetComponentProps } from "@/types/widget";

export function StickyNoteWidget({ config, onConfigChange, width: _width, height: _height }: WidgetComponentProps) {
	const content = config.config?.content || "";
	const color = config.config?.color || "#ffeb3b";
	const [localContent, setLocalContent] = useState(content);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		setLocalContent(content);
	}, [content]);

	const handleChange = useCallback(
		(value: string) => {
			setLocalContent(value);
			if (debounceRef.current) clearTimeout(debounceRef.current);
			debounceRef.current = setTimeout(() => {
				onConfigChange({
					...config,
					config: { ...config.config, content: value },
				});
			}, 500);
		},
		[config, onConfigChange],
	);

	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	return (
		<div
			className="w-full h-full flex flex-col"
			style={{ backgroundColor: color + "cc", borderRadius: 4 }}
		>
			<textarea
				className="flex-1 w-full p-2 bg-transparent resize-none outline-none text-sm text-gray-800 placeholder-gray-500"
				placeholder="输入便签内容..."
				value={localContent}
				onChange={(e) => handleChange(e.target.value)}
				style={{ minHeight: 0 }}
			/>
		</div>
	);
}
