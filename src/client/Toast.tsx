import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

type ToastKind = "error" | "success" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

type ToastContextValue = {
	push: (kind: ToastKind, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const idRef = useRef(0);

	const remove = useCallback((id: number) => {
		setToasts((curr) => curr.filter((t) => t.id !== id));
	}, []);

	const push = useCallback(
		(kind: ToastKind, message: string) => {
			const id = ++idRef.current;
			setToasts((curr) => [...curr, { id, kind, message }]);
			window.setTimeout(() => remove(id), 5000);
		},
		[remove],
	);

	return (
		<ToastContext.Provider value={{ push }}>
			{children}
			<div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
				{toasts.map((t) => (
					<ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
				))}
			</div>
		</ToastContext.Provider>
	);
}

export function useToast(): ToastContextValue {
	const ctx = useContext(ToastContext);
	if (!ctx) throw new Error("useToast must be used inside ToastProvider");
	return ctx;
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
	const [entered, setEntered] = useState(false);
	useEffect(() => {
		const id = window.requestAnimationFrame(() => setEntered(true));
		return () => window.cancelAnimationFrame(id);
	}, []);

	const Icon =
		toast.kind === "error"
			? AlertTriangle
			: toast.kind === "success"
				? CheckCircle2
				: AlertTriangle;
	const tone =
		toast.kind === "error"
			? "border-rose-400/40 text-rose-200"
			: toast.kind === "success"
				? "border-emerald-400/40 text-emerald-200"
				: "border-white/20 text-ink";
	const iconTone =
		toast.kind === "error"
			? "text-rose-300"
			: toast.kind === "success"
				? "text-emerald-300"
				: "text-brand-2";

	return (
		<div
			role="status"
			className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-white/[0.08] px-3.5 py-2.5 text-xs shadow-[0_8px_28px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl transition ${tone} ${
				entered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
			}`}
		>
			<Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconTone}`} strokeWidth={2.2} />
			<p className="min-w-0 flex-1 leading-relaxed">{toast.message}</p>
			<button
				type="button"
				onClick={onClose}
				aria-label="dismiss"
				className="grid h-5 w-5 shrink-0 place-items-center rounded text-mute hover:text-ink"
			>
				<X className="h-3 w-3" strokeWidth={2.5} />
			</button>
		</div>
	);
}
