import { Switch } from "@headlessui/react";
import { cn } from "@/utils/cn";

export function SwitchToggle({
	checked,
	onChange,
}: {
	checked: boolean;
	onChange: (val: boolean) => void;
}) {
	return (
		<Switch
			checked={checked}
			onChange={onChange}
			className={cn(
				checked ? "bg-[var(--color-accent)]" : "bg-black/10 dark:bg-white/10",
				"relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent border border-black/5 dark:border-white/5",
			)}
		>
			<span className="sr-only">Toggle</span>
			<span
				aria-hidden="true"
				className={cn(
					checked ? "translate-x-[22px]" : "translate-x-1",
					"pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-300 ease-in-out",
				)}
			/>
		</Switch>
	);
}
