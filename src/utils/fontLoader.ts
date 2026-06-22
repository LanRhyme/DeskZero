// 预置字体定义
export interface FontPreset {
	id: string;
	name: string;
	nameZh: string;
	family: string;
	type: "link" | "fontface";
	/** link 标签的 href（type=link 时使用） */
	cdnUrl?: string;
	/** @font-face 规则（type=fontface 时使用） */
	fontFaceCss?: string;
}

export const FONT_PRESETS: FontPreset[] = [
	{
		id: "noto-sans-sc",
		name: "Noto Sans SC",
		nameZh: "思源黑体",
		family: '"Noto Sans SC", sans-serif',
		type: "link",
		cdnUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap",
	},
	{
		id: "lxgw-wenkai",
		name: "LXGW WenKai",
		nameZh: "霞鹜文楷",
		family: '"LXGW WenKai", serif',
		type: "link",
		cdnUrl: "https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css",
	},
	{
		id: "fusion-pixel",
		name: "Fusion Pixel Font",
		nameZh: "缝合像素字体",
		family: '"Fusion Pixel 10px Proportional", sans-serif',
		type: "fontface",
		fontFaceCss: `
@font-face {
	font-family: "Fusion Pixel 10px Proportional";
	src: url("https://fusion-pixel-font.takwolf.com/fusion-pixel-10px-proportional-latin.otf.woff2") format("woff2");
	font-display: swap;
}
@font-face {
	font-family: "Fusion Pixel 10px Proportional";
	src: url("https://fusion-pixel-font.takwolf.com/fusion-pixel-10px-proportional-zh_hans.otf.woff2") format("woff2");
	font-display: swap;
	unicode-range: U+4E00-9FFF, U+3400-4DBF, U+3000-303F, U+FF00-FFEF, U+2E80-2EFF, U+31C0-31EF;
}`,
	},
];

// 当前加载的字体 ID，避免重复注入
let currentFontId: string | null = null;

const DEFAULT_FONT = "system-ui, -apple-system, sans-serif";

// 将 font-family 应用到所有标记了 data-font-target 的元素 + body
function applyToAllTargets(fontFamily: string) {
	const value = fontFamily || DEFAULT_FONT;
	document.body.style.fontFamily = value;
	document.querySelectorAll("[data-font-target]").forEach((el) => {
		if (el instanceof HTMLElement) {
			el.style.fontFamily = value;
		}
	});
}

// 应用字体到全局
export function applyFontFamily(fontFamily: string) {
	if (!fontFamily) {
		applyToAllTargets("");
		removeFontElements();
		currentFontId = null;
		return;
	}

	// 检查是否是预置字体
	const preset = FONT_PRESETS.find(
		(f) => f.family === fontFamily || f.id === fontFamily,
	);

	if (preset) {
		if (currentFontId !== preset.id) {
			removeFontElements();
			if (preset.type === "link" && preset.cdnUrl) {
				injectLink(preset.cdnUrl);
			} else if (preset.type === "fontface" && preset.fontFaceCss) {
				injectStyle(preset.fontFaceCss);
			}
			currentFontId = preset.id;
		}
		applyToAllTargets(preset.family);
	} else {
		// 自定义字体名（系统字体），直接设置
		removeFontElements();
		currentFontId = null;
		applyToAllTargets(fontFamily);
	}
}

function injectLink(url: string) {
	const link = document.createElement("link");
	link.id = "deskzero-font-link";
	link.rel = "stylesheet";
	link.href = url;
	document.head.appendChild(link);
}

function injectStyle(css: string) {
	const style = document.createElement("style");
	style.id = "deskzero-font-style";
	style.textContent = css;
	document.head.appendChild(style);
}

function removeFontElements() {
	document.getElementById("deskzero-font-link")?.remove();
	document.getElementById("deskzero-font-style")?.remove();
}
