import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";
import { useMonitorStore } from "@/stores/monitorStore";
import { cn } from "@/utils/cn";

const icons = {
	success: <CheckCircle2 className="w-5 h-5 text-green-500" />,
	error: <AlertCircle className="w-5 h-5 text-red-500" />,
	info: <Info className="w-5 h-5 text-[var(--color-accent)]" />,
	warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
	loading: (
		<svg className="animate-spin h-5 w-5 text-[var(--color-accent)]" viewBox="0 0 24 24">
			<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
			<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
		</svg>
	),
};

function ToastDisplay({ monitorX, monitorWidth }: { monitorX: number; monitorWidth: number }) {
	const toasts = useToastStore((state) => state.toasts);
	const globalBlur = useSettingsStore((state) => state.settings.globalBlur);

	const centerX = monitorX + monitorWidth / 2;

	return (
		<div
			className="absolute top-8 flex flex-col gap-2 pointer-events-none"
			style={{ left: centerX, transform: "translateX(-50%)" }}
		>
			<AnimatePresence>
				{toasts.map((toast) => (
					<motion.div
						key={toast.id}
						initial={{ opacity: 0, y: -20, scale: 0.9 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
						className={cn(
							"pointer-events-auto flex items-center gap-3 px-5 py-2.5 rounded-full shadow-lg border text-sm font-medium",
							globalBlur
								? "bg-[#f3f3f3]/80 dark:bg-[#202020]/80 backdrop-blur-[30px] border-white/20 dark:border-white/10 text-gray-800 dark:text-gray-200 shadow-black/10"
								: "bg-white dark:bg-[#202020] border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-200 shadow-black/20",
						)}
					>
						{icons[toast.type || "info"]}
						<span>{toast.message}</span>
					</motion.div>
				))}
			</AnimatePresence>
		</div>
	);
}

export function ToastContainer() {
	const monitors = useMonitorStore((state) => state.monitors);

	// 优先在聚焦的显示器上显示，其次是主显示器，避免多显示器跨屏
	const currentMonitorId = useMonitorStore((state) => state.currentMonitorId);
	const primary = monitors.find((m) => m.isPrimary);
	const current = monitors.find((m) => m.id === currentMonitorId);
	const target = current ?? primary ?? monitors[0];

	if (!target) {
		return <ToastDisplay monitorX={0} monitorWidth={window.innerWidth} />;
	}

	return <ToastDisplay monitorX={target.x} monitorWidth={target.width} />;
}
