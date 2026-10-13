"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type FolderKey = "LABEL" | "ARCHIVE" | "REPLY" | "SPAM";

interface Tag {
	text: string;
	color: string;
}

interface InboxItem {
	from: string;
	subj: string;
	rule: string;
	tags: Tag[];
	folder: FolderKey;
}

interface Folder {
	key: FolderKey;
	label: string;
	icon: ReactNode;
}

const COLORS = {
	ink: "#140F24",
	ink2: "#1D1638",
	paper: "#F7F5FC",
	slate: "#9993B5",
	line: "#2C2350",
	amber: "#F2A93B",
	mint: "#35D399",
	blue: "#6C8EF5",
	red: "#F0616B",
	violet: "#5632FB",
};

const ITEMS: InboxItem[] = [
	{
		from: "Stripe Billing",
		subj: "Invoice #4471 — Oct payment received",
		rule: "if sender is billing → label Finance, archive",
		tags: [
			{ text: "LABEL: FINANCE", color: COLORS.amber },
			{ text: "ARCHIVE", color: COLORS.blue },
		],
		folder: "ARCHIVE",
	},
	{
		from: "Maria Chen",
		subj: "re: can we push the sync to Thursday?",
		rule: "if reschedule request → draft reply",
		tags: [{ text: "DRAFT REPLY", color: COLORS.mint }],
		folder: "REPLY",
	},
	{
		from: "GrowthBlast Deals",
		subj: "70% OFF everything — today only!!!",
		rule: "if promo pattern matched → mark spam",
		tags: [{ text: "MARK SPAM", color: COLORS.red }],
		folder: "SPAM",
	},
	{
		from: "Ankith · Linear",
		subj: "Issue POP-142 moved to In Review",
		rule: "if project = Mail Monkey → label Team",
		tags: [{ text: "LABEL: TEAM", color: COLORS.violet }],
		folder: "LABEL",
	},
];

const FOLDERS: Folder[] = [
	{
		key: "LABEL",
		label: "Label",
		icon: (
			<path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6M14 2l6 6-9 9H5v-6z" />
		),
	},
	{
		key: "ARCHIVE",
		label: "Archive",
		icon: (
			<>
				<rect x="3" y="4" width="18" height="5" rx="1" />
				<path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
			</>
		),
	},
	{
		key: "REPLY",
		label: "Reply",
		icon: <path d="M9 17l-5-5 5-5M20 18v-2a4 4 0 0 0-4-4H4" />,
	},
	{
		key: "SPAM",
		label: "Spam",
		icon: (
			<>
				<circle cx="12" cy="12" r="9" />
				<path d="M9 9l6 6M15 9l-6 6" />
			</>
		),
	},
];

function wait(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function MailMonkeyInboxDemo() {
	const [count, setCount] = useState(0);
	const [current, setCurrent] = useState<InboxItem>(ITEMS[0]);
	const [cardState, setCardState] = useState<
		"idle" | "enter" | "flash" | "exit"
	>("idle");
	const [showRule, setShowRule] = useState(false);
	const [visibleTags, setVisibleTags] = useState(0);
	const [hitFolder, setHitFolder] = useState<FolderKey | null>(null);
	const indexRef = useRef(0);
	const runningRef = useRef(true);

	useEffect(() => {
		runningRef.current = true;

		async function runCycle() {
			while (runningRef.current) {
				const item = ITEMS[indexRef.current % ITEMS.length];
				indexRef.current++;

				setCurrent(item);
				setCardState("idle");
				setShowRule(false);
				setVisibleTags(0);
				setHitFolder(null);

				await wait(30);
				if (!runningRef.current) {
					return;
				}
				setCardState("enter");
				await wait(500);
				if (!runningRef.current) {
					return;
				}

				setShowRule(true);
				await wait(550);
				if (!runningRef.current) {
					return;
				}

				for (let idx = 0; idx < item.tags.length; idx++) {
					setVisibleTags(idx + 1);
					await wait(160);
					if (!runningRef.current) {
						return;
					}
				}
				setCardState("flash");
				await wait(500);
				if (!runningRef.current) {
					return;
				}

				setHitFolder(item.folder);
				setCardState("exit");
				await wait(500);
				if (!runningRef.current) {
					return;
				}
				setHitFolder(null);

				setCount((c) => c + 1);
				await wait(350);
			}
		}

		runCycle();
		return () => {
			runningRef.current = false;
		};
	}, []);

	const flashColor = current.tags[0]?.color ?? COLORS.mint;

	const cardTransform =
		cardState === "enter" || cardState === "flash"
			? "translateX(0)"
			: cardState === "exit"
				? "translateX(130%)"
				: "translateX(-140%)";
	const cardOpacity = cardState === "idle" || cardState === "exit" ? 0 : 1;

	return (
		<div
			style={{
				width: "100%",
				maxWidth: 560,
				height: 440,
				borderRadius: 20,
				padding: "26px 26px 20px",
				position: "relative",
				overflow: "hidden",
				fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif",
				background: `linear-gradient(180deg, ${COLORS.ink} 0%, ${COLORS.ink2} 100%)`,
				boxShadow: "0 30px 80px -20px rgba(0,0,0,0.5)",
			}}
		>
			{/* brand glow */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					background:
						"radial-gradient(circle at 85% 0%, rgba(86,50,251,0.20), transparent 55%), radial-gradient(circle at 0% 100%, rgba(86,50,251,0.10), transparent 50%)",
					pointerEvents: "none",
				}}
			/>

			{/* header */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: 18,
					position: "relative",
					zIndex: 2,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<span
						style={{
							width: 8,
							height: 8,
							borderRadius: "50%",
							background: COLORS.mint,
							display: "inline-block",
							animation: "mailmonkey-pulse 2s infinite",
						}}
					/>
					<span
						style={{
							color: COLORS.paper,
							fontSize: 13,
							letterSpacing: "0.04em",
							fontWeight: 600,
						}}
					>
						Mail Monkey · LIVE
					</span>
				</div>
				<div
					style={{
						color: COLORS.slate,
						fontSize: 12,
						fontVariantNumeric: "tabular-nums",
					}}
				>
					processed today —{" "}
					<b style={{ color: COLORS.paper, fontWeight: 600 }}>
						{count}
					</b>
				</div>
			</div>

			{/* stage */}
			<div
				style={{
					position: "relative",
					zIndex: 2,
					height: 320,
					display: "grid",
					gridTemplateColumns: "1fr 78px",
					gap: 14,
				}}
			>
				{/* inbox */}
				<div
					style={{
						position: "relative",
						border: `1px solid ${COLORS.line}`,
						borderRadius: 14,
						background: "rgba(255,255,255,0.02)",
						overflow: "hidden",
						padding: 12,
					}}
				>
					<span
						style={{
							color: COLORS.slate,
							fontSize: 10.5,
							letterSpacing: "0.12em",
							textTransform: "uppercase",
							marginBottom: 10,
							display: "block",
						}}
					>
						Inbox
					</span>

					<div
						style={{
							position: "absolute",
							left: 12,
							right: 12,
							top: 40,
							background: COLORS.paper,
							borderRadius: 10,
							padding: "13px 14px 12px",
							transform: cardTransform,
							opacity: cardOpacity,
							transition:
								"transform 0.55s cubic-bezier(.22,1,.36,1), opacity 0.4s ease, box-shadow 0.3s ease",
							boxShadow:
								cardState === "flash"
									? `0 0 0 2px ${flashColor}, 0 8px 24px -8px rgba(0,0,0,0.35)`
									: "0 8px 24px -8px rgba(0,0,0,0.35)",
						}}
					>
						<div
							style={{
								fontSize: 12.5,
								fontWeight: 700,
								color: "#16151C",
							}}
						>
							{current.from}
						</div>
						<div
							style={{
								fontSize: 12,
								color: "#4B5568",
								marginTop: 3,
								fontFamily:
									"'IBM Plex Mono', ui-monospace, monospace",
							}}
						>
							{current.subj}
						</div>

						<div
							style={{
								marginTop: 9,
								fontSize: 10.5,
								color: "#7A6A4A",
								background: "rgba(242,169,59,0.14)",
								border: "1px dashed rgba(242,169,59,0.5)",
								borderRadius: 6,
								padding: "5px 8px",
								display: "inline-block",
								fontFamily:
									"'IBM Plex Mono', ui-monospace, monospace",
								opacity: showRule ? 1 : 0,
								transform: showRule
									? "translateY(0)"
									: "translateY(4px)",
								transition:
									"opacity 0.35s ease, transform 0.35s ease",
								maxWidth: "100%",
							}}
						>
							{current.rule}
						</div>

						<div
							style={{
								marginTop: 9,
								display: "flex",
								gap: 6,
								flexWrap: "wrap",
								minHeight: 20,
							}}
						>
							{current.tags
								.slice(0, visibleTags)
								.map((tag, idx) => (
									<span
										key={`${current.from}-${idx}`}
										style={{
											fontSize: 10,
											fontWeight: 700,
											letterSpacing: "0.03em",
											padding: "3px 8px",
											borderRadius: 20,
											color: "#0E1526",
											background: tag.color,
											display: "inline-block",
											animation:
												"mailmonkey-pop 0.5s cubic-bezier(.34,1.56,.64,1) forwards",
										}}
									>
										{tag.text}
									</span>
								))}
						</div>
					</div>
				</div>

				{/* folder rail */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: 10,
						paddingTop: 40,
					}}
				>
					{FOLDERS.map((folder) => {
						const isHit = hitFolder === folder.key;
						return (
							<div
								key={folder.key}
								style={{
									border: `1px solid ${isHit ? current.tags[0]?.color : COLORS.line}`,
									borderRadius: 10,
									height: 58,
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									justifyContent: "center",
									gap: 4,
									color: isHit ? COLORS.paper : COLORS.slate,
									fontSize: 9,
									letterSpacing: "0.06em",
									textTransform: "uppercase",
									fontFamily:
										"'IBM Plex Mono', ui-monospace, monospace",
									transform: isHit
										? "scale(1.08)"
										: "scale(1)",
									transition:
										"transform 0.35s ease, border-color 0.35s ease, color 0.35s ease",
								}}
							>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth={2}
									width={16}
									height={16}
								>
									<title>{folder.label}</title>
									{folder.icon}
								</svg>
								{folder.label}
							</div>
						);
					})}
				</div>
			</div>

			<div
				style={{
					position: "relative",
					zIndex: 2,
					marginTop: 14,
					textAlign: "center",
					color: COLORS.slate,
					fontSize: 11,
				}}
			>
				Rules run in plain English — no filters to configure,{" "}
				<b style={{ color: COLORS.paper }}>Mail Monkey</b> reads and
				acts.
			</div>

			<style>{`
				@keyframes mailmonkey-pulse {
					0% { box-shadow: 0 0 0 0 rgba(53,211,153,0.55); }
					70% { box-shadow: 0 0 0 7px rgba(53,211,153,0); }
					100% { box-shadow: 0 0 0 0 rgba(53,211,153,0); }
				}
				@keyframes mailmonkey-pop {
					0% { transform: scale(0); opacity: 0; }
					60% { transform: scale(1.15); opacity: 1; }
					100% { transform: scale(1); opacity: 1; }
				}
			`}</style>
		</div>
	);
}
