import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";
import { cn } from "@/utils/cn";

const icons = {
	success: <CheckCircle2 className="w-5 h-5 text-green-500" />,
	error: <AlertCircle className="w-5 h-5 text-red-500" />,
	info: <Info className="w-5 h-5 text-[var(--color-accent)]" />,
	warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
};

export function ToastContainer() {
	const toasts = useToastStore((state) => state.toasts);
	const globalBlur = useSettingsStore((state) => state.settings.globalBlur);

	return (
		<div className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none">
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
