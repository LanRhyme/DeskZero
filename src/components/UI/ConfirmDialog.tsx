import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useMonitorStore } from "@/stores/monitorStore";
import { useSettingsStore } from "@/stores/settingsStore";

interface ConfirmDialogProps {
	isOpen: boolean;
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	confirmStyle?: "danger" | "default";
	onConfirm: () => void;
	onCancel: () => void;
}

export function ConfirmDialog({
	isOpen,
	title,
	message,
	confirmLabel: confirmLabelProp,
	cancelLabel: cancelLabelProp,
	confirmStyle = "danger",
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	const { t } = useTranslation();
	const confirmLabel = confirmLabelProp ?? t("common.confirm");
	const cancelLabel = cancelLabelProp ?? t("common.cancel");

	const { currentMonitorId, getMonitorById, getPrimaryMonitor } = useMonitorStore();
	const isDesktop = window.location.pathname !== "/settings";
	let monitorStyle: React.CSSProperties = { inset: 0 };
	if (isDesktop) {
		const settings = useSettingsStore.getState().settings;
		const preferPrimary = settings.dialogMonitorPreference === "primary";
		const { currentMonitorId, getMonitorById, monitors } = useMonitorStore.getState();
		
		let monitor = monitors.find(m => m.isPrimary) ?? monitors[0];
		if (!preferPrimary && currentMonitorId) {
			monitor = getMonitorById(currentMonitorId) || monitor;
		}

		if (monitor) {
			monitorStyle = {
				left: monitor.x,
				top: monitor.y,
				width: monitor.width,
				height: monitor.height,
			};
		}
	}

	return (
		<AnimatePresence>
			{isOpen && (
				<div className="fixed z-[200] flex items-center justify-center p-4" style={monitorStyle}>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onCancel}
						className="absolute inset-0 bg-black/40 backdrop-blur-sm"
					/>
					<motion.div
						initial={{ opacity: 0, scale: 0.95, y: 10 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 10 }}
						transition={{ type: "spring", duration: 0.4, bounce: 0 }}
						className="relative w-full max-w-sm bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-xl rounded-xl shadow-2xl border border-black/5 dark:border-white/10 overflow-hidden"
					>
						<div className="p-5">
							<h3 className="text-sm font-semibold text-[var(--color-text)] mb-2">
								{title}
							</h3>
							<p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
								{message}
							</p>
						</div>
						<div className="flex gap-2 px-5 pb-4">
							<button
								type="button"
								className="flex-1 justify-center rounded-lg border border-transparent bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors focus:outline-none"
								onClick={onCancel}
							>
								{cancelLabel}
							</button>
							<button
								type="button"
								className={`flex-1 justify-center rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-white transition-colors shadow-md focus:outline-none ${
									confirmStyle === "danger"
										? "bg-red-500 hover:bg-red-600 shadow-red-500/25"
										: "bg-[var(--color-accent)] hover:bg-[var(--color-accent)] shadow-[var(--color-accent)]/25"
								}`}
								onClick={onConfirm}
							>
								{confirmLabel}
							</button>
						</div>
					</motion.div>
				</div>
			)}
		</AnimatePresence>
	);
}
