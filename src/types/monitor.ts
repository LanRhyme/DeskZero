export interface WorkArea {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Monitor {
	id: string;
	name: string;
	x: number;
	y: number;
	width: number;
	height: number;
	isPrimary: boolean;
	scaleFactor: number;
	workArea: WorkArea;
}
