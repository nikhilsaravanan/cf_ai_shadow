import { createRemoteJWKSet, jwtVerify } from "jose";

type JWKSet = ReturnType<typeof createRemoteJWKSet>;

const jwksCache = new Map<string, JWKSet>();

function getJwks(supabaseUrl: string): JWKSet {
	const url = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
	let jwks = jwksCache.get(url);
	if (!jwks) {
		jwks = createRemoteJWKSet(new URL(url));
		jwksCache.set(url, jwks);
	}
	return jwks;
}

export type AuthedUser = { sub: string; email?: string };

export async function verifySupabaseJwt(
	token: string,
	env: Env,
): Promise<AuthedUser | null> {
	try {
		const { payload } = await jwtVerify(token, getJwks(env.SUPABASE_URL), {
			issuer: `${env.SUPABASE_URL}/auth/v1`,
		});
		if (typeof payload.sub !== "string") return null;
		return {
			sub: payload.sub,
			email: typeof payload.email === "string" ? payload.email : undefined,
		};
	} catch {
		return null;
	}
}

// Returns a Response on denial (caller should return it), or null to pass through.
// Path rule: /agents/<kebab-class>/<name>/...
// - researcher-agent: name MUST equal authenticated user's sub (JWT subject UUID).
//   Without this check, user A could connect to user B's DO by guessing the UUID.
// - wallet-agent: any authenticated user may connect (wallet data is public on-chain).
// - Non-agent paths fall through (in prod, run_worker_first ensures only /agents/* hits this worker).
export async function authorize(
	request: Request,
	env: Env,
): Promise<Response | null> {
	const url = new URL(request.url);
	const segments = url.pathname.split("/").filter(Boolean);
	if (segments[0] !== "agents") return null;

	const token = url.searchParams.get("token");
	if (!token) return new Response("Missing token", { status: 401 });
	const user = await verifySupabaseJwt(token, env);
	if (!user) return new Response("Invalid token", { status: 401 });

	const agentClass = segments[1];
	const agentName = segments[2];
	if (agentClass === "researcher-agent" && agentName !== user.sub) {
		return new Response("Forbidden", { status: 403 });
	}
	return null;
}
