export function hexToRgb(hex: string): string {
	let c = hex.substring(1).split("");
	if (c.length === 3) {
		c = [c[0], c[0], c[1], c[1], c[2], c[2]];
	}
	const cNum = Number("0x" + c.join(""));
	return [(cNum >> 16) & 255, (cNum >> 8) & 255, cNum & 255].join(",");
}
