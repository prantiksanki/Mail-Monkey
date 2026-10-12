import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, {
	Defs,
	G,
	Line,
	LinearGradient,
	Path,
	Stop,
	Text as SvgText,
} from "react-native-svg";
import type { VolumePoint } from "@/lib/api";

// Categorical pair validated for CVD separation against the light surface
// (protan ΔE 21.7 / normal 22.6). Both are the app's existing accent hues.
const TOTAL = "#141718";
const MATCHED = "#22a06b";

const CHART_H = 150;
const PAD_LEFT = 30;
const PAD_RIGHT = 10;
const PAD_TOP = 10;

// Rounds the axis top up to a readable step so gridline labels stay whole.
function niceMax(value: number): number {
	if (value <= 5) {
		return 5;
	}
	const pow = 10 ** Math.floor(Math.log10(value));
	return Math.ceil(value / (pow / 2)) * (pow / 2);
}

function buildPaths(values: number[], w: number, maxY: number) {
	if (values.length === 0) {
		return { line: "", area: "" };
	}
	const stepX = values.length > 1 ? w / (values.length - 1) : 0;
	const y = (v: number) => PAD_TOP + (1 - v / maxY) * (CHART_H - PAD_TOP);
	const line = values
		.map(
			(v, i) =>
				`${i === 0 ? "M" : "L"}${(i * stepX).toFixed(2)},${y(v).toFixed(2)}`,
		)
		.join(" ");
	const lastX = ((values.length - 1) * stepX).toFixed(2);
	return { line, area: `${line} L${lastX},${CHART_H} L0,${CHART_H} Z` };
}

function fmtDate(iso: string): string {
	return new Date(iso).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
}

export function EmailVolumeChart({ data }: { data: VolumePoint[] }) {
	const { width } = useWindowDimensions();
	// 12px screen margin each side + 16px card padding each side.
	const plotW = Math.max(80, width - 24 - 32 - PAD_LEFT - PAD_RIGHT);

	if (data.length === 0) {
		return (
			<View style={styles.empty}>
				<Text style={styles.emptyText}>No volume yet.</Text>
			</View>
		);
	}

	const maxY = niceMax(Math.max(1, ...data.map((d) => d.total)));
	const total = buildPaths(
		data.map((d) => d.total),
		plotW,
		maxY,
	);
	const matched = buildPaths(
		data.map((d) => d.matched),
		plotW,
		maxY,
	);
	const ticks = [0, maxY / 2, maxY];

	return (
		<View>
			<Svg width={plotW + PAD_LEFT + PAD_RIGHT} height={CHART_H + 22}>
				<Defs>
					<LinearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
						<Stop offset="0" stopColor={TOTAL} stopOpacity={0.35} />
						<Stop offset="1" stopColor={TOTAL} stopOpacity={0.02} />
					</LinearGradient>
					<LinearGradient
						id="fillMatched"
						x1="0"
						y1="0"
						x2="0"
						y2="1"
					>
						<Stop
							offset="0"
							stopColor={MATCHED}
							stopOpacity={0.28}
						/>
						<Stop
							offset="1"
							stopColor={MATCHED}
							stopOpacity={0.02}
						/>
					</LinearGradient>
				</Defs>

				{/* Recessive gridlines + y labels */}
				{ticks.map((t) => {
					const y = PAD_TOP + (1 - t / maxY) * (CHART_H - PAD_TOP);
					return (
						<Line
							key={`g${t}`}
							x1={PAD_LEFT}
							y1={y}
							x2={PAD_LEFT + plotW}
							y2={y}
							stroke="#ececef"
							strokeWidth={1}
						/>
					);
				})}
				{ticks.map((t) => {
					const y = PAD_TOP + (1 - t / maxY) * (CHART_H - PAD_TOP);
					return (
						<SvgText
							key={`t${t}`}
							x={PAD_LEFT - 6}
							y={y + 3}
							fontSize={9}
							fill="#9aa0a6"
							textAnchor="end"
						>
							{String(Math.round(t))}
						</SvgText>
					);
				})}

				{/* Total sits behind matched — matched is always <= total. */}
				<G translateX={PAD_LEFT}>
					<Path d={total.area} fill="url(#fillTotal)" />
					<Path
						d={total.line}
						stroke={TOTAL}
						strokeWidth={2}
						fill="none"
						strokeLinejoin="round"
						strokeLinecap="round"
					/>
					<Path d={matched.area} fill="url(#fillMatched)" />
					<Path
						d={matched.line}
						stroke={MATCHED}
						strokeWidth={2}
						fill="none"
						strokeLinejoin="round"
						strokeLinecap="round"
					/>
				</G>

				{/* Only the endpoints get date labels — never one per point. */}
				<SvgText
					x={PAD_LEFT}
					y={CHART_H + 16}
					fontSize={9}
					fill="#9aa0a6"
					textAnchor="start"
				>
					{fmtDate(data[0].date)}
				</SvgText>
				<SvgText
					x={PAD_LEFT + plotW}
					y={CHART_H + 16}
					fontSize={9}
					fill="#9aa0a6"
					textAnchor="end"
				>
					{fmtDate(data[data.length - 1].date)}
				</SvgText>
			</Svg>

			{/* Legend: identity is never carried by color alone. */}
			<View style={styles.legend}>
				<View style={styles.legendItem}>
					<View style={[styles.swatch, { backgroundColor: TOTAL }]} />
					<Text style={styles.legendText}>Total</Text>
				</View>
				<View style={styles.legendItem}>
					<View
						style={[styles.swatch, { backgroundColor: MATCHED }]}
					/>
					<Text style={styles.legendText}>Matched by rules</Text>
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	empty: { paddingVertical: 40, alignItems: "center" },
	emptyText: { fontSize: 13, color: "#9aa0a6" },
	legend: { flexDirection: "row", gap: 16, marginTop: 10, paddingLeft: 30 },
	legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
	swatch: { width: 8, height: 8, borderRadius: 2 },
	legendText: { fontSize: 12, color: "#6b7280" },
});
