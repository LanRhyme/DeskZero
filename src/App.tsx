import { useEffect } from "react";
import DesktopLayer from "@/components/Desktop/DesktopLayer";
import { SettingsPage } from "@/components/Settings/SettingsPage";
import { ToastContainer } from "@/components/UI/ToastContainer";
import { useSettingsStore } from "@/stores/settingsStore";
import { useMonitorStore } from "@/stores/monitorStore";

function App() {
	const isSettings = window.location.pathname === "/settings";
	const { loadSettings, initThemeListener } = useSettingsStore();
	const fetchMonitors = useMonitorStore((state) => state.fetchMonitors);

	useEffect(() => {
		loadSettings();
		fetchMonitors();
		const cleanup = initThemeListener();
		return cleanup;
	}, [loadSettings, initThemeListener, fetchMonitors]);

	return (
		<div className="relative w-full h-full">
			<ToastContainer />
			{isSettings ? <SettingsPage /> : <DesktopLayer />}
		</div>
	);
}

export default App;
