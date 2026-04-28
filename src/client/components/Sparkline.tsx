// Deterministic-from-seed sparkline. Shadow doesn't track historical metrics,
// so we synthesize a stable pseudo-walk per (seed, length) so the same wallet
// always sees the same shape — purely decorative, mirrors Figma's BTC/ETH cards.
function rand(state: { v: number }): number {
	state.v = (state.v * 1664525 + 1013904223) >>> 0;
	return (state.v >>> 0) / 0xffffffff;
}

function seedHash(seed: string): number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 16777619) >>> 0;
	}
	return h >>> 0 || 1;
}

export function sparklinePath(
	seed: string,
	width: number,
	height: number,
	points = 24,
): { line: string; area: string } {
	const state = { v: seedHash(seed) };
	const ys: number[] = [];
	let v = 0.5;
	for (let i = 0; i < points; i++) {
		v += (rand(state) - 0.5) * 0.18;
		v = Math.max(0.1, Math.min(0.9, v));
		ys.push(v);
	}
	const stepX = width / (points - 1);
	const padY = 4;
	const usableH = height - padY * 2;
	const linePts = ys.map((y, i) => [i * stepX, padY + (1 - y) * usableH] as const);
	const line = linePts
		.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
		.join(" ");
	const area =
		`M0 ${height} ` +
		linePts
			.map(([x, y], i) => `${i === 0 ? "L" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
			.join(" ") +
		` L${width} ${height} Z`;
	return { line, area };
}

export function Sparkline({
	seed,
	className,
	color = "#f97316",
	gradientId,
}: {
	seed: string;
	className?: string;
	color?: string;
	gradientId: string;
}) {
	const w = 120;
	const h = 36;
	const { line, area } = sparklinePath(seed, w, h);
	return (
		<svg
			viewBox={`0 0 ${w} ${h}`}
			width="100%"
			height={h}
			preserveAspectRatio="none"
			className={className}
		>
			<defs>
				<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor={color} stopOpacity="0.45" />
					<stop offset="100%" stopColor={color} stopOpacity="0" />
				</linearGradient>
				<filter
					id={`${gradientId}-glow`}
					x="-30%"
					y="-100%"
					width="160%"
					height="300%"
				>
					<feGaussianBlur stdDeviation="2.5" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			</defs>
			<path d={area} fill={`url(#${gradientId})`} />
			{/* colored halo behind the bright line — gives the "light source" the
			    same hue as the card bleed so it reads as one luminous element */}
			<path
				d={line}
				fill="none"
				stroke={color}
				strokeOpacity="0.7"
				strokeWidth="3.4"
				strokeLinecap="round"
				strokeLinejoin="round"
				filter={`url(#${gradientId}-glow)`}
			/>
			{/* bright core stroke — the actual "filament" */}
			<path
				d={line}
				fill="none"
				stroke="#ffffff"
				strokeOpacity="0.95"
				strokeWidth="1.4"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
