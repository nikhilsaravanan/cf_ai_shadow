import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { AuthProvider, useSessionState } from "./lib/auth";
import { SignIn } from "./SignIn";

export function AuthGate({ children }: { children: ReactNode }) {
	const state = useSessionState();

	if (state.status === "loading") {
		return (
			<div className="grid min-h-full place-items-center text-mute">
				<Loader2 className="h-5 w-5 animate-spin" />
			</div>
		);
	}

	if (state.status === "signedOut") {
		return <SignIn />;
	}

	return (
		<AuthProvider user={state.session.user}>{children}</AuthProvider>
	);
}
