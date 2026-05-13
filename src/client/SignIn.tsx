import { useState, type FormEvent } from "react";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "./lib/supabase";

type MagicLinkState =
	| { status: "idle" }
	| { status: "sending" }
	| { status: "sent"; email: string }
	| { status: "error"; message: string };

export function SignIn() {
	const [email, setEmail] = useState("");
	const [magic, setMagic] = useState<MagicLinkState>({ status: "idle" });
	const [googleLoading, setGoogleLoading] = useState(false);

	const signInWithGoogle = async () => {
		setGoogleLoading(true);
		const { error } = await supabase.auth.signInWithOAuth({
			provider: "google",
			options: {
				redirectTo: window.location.origin,
				// Force Google to show the account chooser every time. Without this,
				// Google silently reuses the active session in the browser profile
				// (e.g. across incognito windows that share a Google login).
				queryParams: { prompt: "select_account" },
			},
		});
		if (error) {
			setGoogleLoading(false);
			setMagic({ status: "error", message: error.message });
		}
		// On success the browser navigates away; no need to clear loading.
	};

	const sendMagicLink = async (e: FormEvent) => {
		e.preventDefault();
		const addr = email.trim();
		if (!addr) return;
		setMagic({ status: "sending" });
		const { error } = await supabase.auth.signInWithOtp({
			email: addr,
			options: { emailRedirectTo: window.location.origin },
		});
		if (error) {
			setMagic({ status: "error", message: error.message });
			return;
		}
		setMagic({ status: "sent", email: addr });
	};

	return (
		<div className="relative grid min-h-full place-items-center px-6">
			<BackgroundBlobs />
			<div className="glass w-full max-w-sm rounded-2xl p-8">
				<div className="mb-6 text-center">
					<div className="inline-grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-lg font-bold text-white shadow-sm">
						S
					</div>
					<h1 className="mt-4 text-xl font-bold text-ink">Welcome to Shadow</h1>
					<p className="mt-1 text-sm text-mute">
						Sign in to start tailing wallets.
					</p>
				</div>

				<button
					type="button"
					onClick={signInWithGoogle}
					disabled={googleLoading}
					className="flex w-full items-center justify-center gap-2 rounded-full border border-edge bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-white/5 disabled:opacity-50"
				>
					{googleLoading ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<GoogleGlyph />
					)}
					Continue with Google
				</button>

				<div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-mute-2">
					<div className="h-px flex-1 bg-edge" />
					or
					<div className="h-px flex-1 bg-edge" />
				</div>

				{magic.status === "sent" ? (
					<div className="flex items-start gap-2 rounded-xl border border-edge bg-surface-2 px-4 py-3 text-xs text-mute">
						<CheckCircle2
							className="mt-0.5 h-4 w-4 shrink-0 text-brand-2"
							strokeWidth={2.5}
						/>
						<div>
							<p className="font-semibold text-ink">Check your inbox</p>
							<p className="mt-0.5">
								We sent a magic link to <b>{magic.email}</b>. Click it to sign
								in.
							</p>
						</div>
					</div>
				) : (
					<form onSubmit={sendMagicLink} className="space-y-2">
						<label className="block">
							<span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-mute-2">
								Email magic link
							</span>
							<div className="flex items-center gap-2 rounded-full border border-edge bg-surface-2 px-3.5 py-2 transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
								<Mail
									className="h-4 w-4 text-mute-2"
									strokeWidth={2}
								/>
								<input
									type="email"
									required
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="you@example.com"
									className="flex-1 bg-transparent text-sm text-ink placeholder:text-mute focus:outline-none"
								/>
							</div>
						</label>
						<button
							type="submit"
							disabled={magic.status === "sending" || !email.trim()}
							className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand to-brand-2 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-40"
						>
							{magic.status === "sending" ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : null}
							Send magic link
						</button>
						{magic.status === "error" ? (
							<p className="text-center text-xs text-red-400">
								{magic.message}
							</p>
						) : null}
					</form>
				)}
			</div>
		</div>
	);
}

function GoogleGlyph() {
	return (
		<svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden="true">
			<path
				fill="#4285F4"
				d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
			/>
			<path
				fill="#34A853"
				d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
			/>
			<path
				fill="#FBBC05"
				d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
			/>
			<path
				fill="#EA4335"
				d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
			/>
		</svg>
	);
}

function BackgroundBlobs() {
	return (
		<div
			className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
			aria-hidden="true"
		>
			<div className="absolute inset-0 bg-canvas" />
			<div
				className="absolute -right-40 -top-40 h-[600px] w-[600px] rounded-full opacity-15"
				style={{
					background:
						"radial-gradient(circle, var(--color-blob-violet) 0%, transparent 65%)",
					filter: "blur(100px)",
				}}
			/>
			<div
				className="absolute -bottom-40 -left-32 h-[580px] w-[580px] rounded-full opacity-12"
				style={{
					background:
						"radial-gradient(circle, var(--color-blob-teal) 0%, transparent 65%)",
					filter: "blur(100px)",
				}}
			/>
		</div>
	);
}
