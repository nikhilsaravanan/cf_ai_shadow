import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthContextValue = {
	user: User;
	signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used inside <AuthGate>");
	return ctx;
}

type SessionState =
	| { status: "loading" }
	| { status: "signedOut" }
	| { status: "signedIn"; session: Session };

export function useSessionState(): SessionState {
	const [state, setState] = useState<SessionState>({ status: "loading" });

	useEffect(() => {
		let cancelled = false;
		supabase.auth.getSession().then(({ data }) => {
			if (cancelled) return;
			setState(
				data.session
					? { status: "signedIn", session: data.session }
					: { status: "signedOut" },
			);
		});
		const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
			setState(
				session
					? { status: "signedIn", session }
					: { status: "signedOut" },
			);
		});
		return () => {
			cancelled = true;
			sub.subscription.unsubscribe();
		};
	}, []);

	return state;
}

export function AuthProvider({
	user,
	children,
}: {
	user: User;
	children: ReactNode;
}) {
	const value = useMemo<AuthContextValue>(
		() => ({
			user,
			signOut: async () => {
				// scope: "local" clears the session in this browser without round-tripping
				// to Supabase's /logout endpoint. Avoids CORS/network failure modes that
				// can make the default "global" scope hang silently.
				const { error } = await supabase.auth.signOut({ scope: "local" });
				if (error) {
					console.error("signOut error:", error);
					for (const key of Object.keys(localStorage)) {
						if (key.startsWith("sb-")) localStorage.removeItem(key);
					}
					window.location.reload();
				}
			},
		}),
		[user],
	);
	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Helper for any useAgent / useAgentChat call that needs the JWT.
// Returns a fresh access_token on each connection attempt (so refreshed tokens
// are picked up automatically). queryDeps re-fires when the user changes.
export function useAuthedAgentOptions(userId: string) {
	return useMemo(
		() => ({
			query: async (): Promise<Record<string, string | null>> => {
				const { data } = await supabase.auth.getSession();
				return { token: data.session?.access_token ?? null };
			},
			queryDeps: [userId] as unknown[],
		}),
		[userId],
	);
}
