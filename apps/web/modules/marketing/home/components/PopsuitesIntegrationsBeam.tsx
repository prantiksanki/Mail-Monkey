"use client";

import { cn } from "@repo/ui";
import Image from "next/image";
import { useEffect, useState } from "react";

interface Mockup {
	key: string;
	src: string;
	width: number;
	height: number;
	alt: string;
}

const mockups: Mockup[] = [
	{
		key: "unified-stream",
		src: "/images/integration-mockups/mockup-1.png",
		width: 1530,
		height: 1028,
		alt: "Popsuites unified inbox showing new email, Slack, Zoom, and WhatsApp notifications in one stream",
	},
	{
		key: "connected-tools",
		src: "/images/integration-mockups/mockup-2.png",
		width: 1536,
		height: 1024,
		alt: "Gmail, Slack, and other connected tools feeding into one inbox view",
	},
	{
		key: "routed-mail",
		src: "/images/integration-mockups/mockup-3.png",
		width: 1506,
		height: 838,
		alt: "Mail from multiple sources being routed into a single organized inbox",
	},
	{
		key: "many-providers",
		src: "/images/integration-mockups/mockup-4.png",
		width: 1832,
		height: 858,
		alt: "Gmail, Outlook, Yahoo Mail, and other providers all connecting into Popsuites",
	},
	{
		key: "smart-signals",
		src: "/images/integration-mockups/mockup-5.png",
		width: 1536,
		height: 1024,
		alt: "Popsuites surfacing a smart reply suggestion alongside connected accounts",
	},
];

const AUTO_ADVANCE_MS = 4500;

export function PopsuitesIntegrationsBeam() {
	const [activeIndex, setActiveIndex] = useState(0);

	useEffect(() => {
		const timer = setInterval(() => {
			setActiveIndex((index) => (index + 1) % mockups.length);
		}, AUTO_ADVANCE_MS);
		return () => clearInterval(timer);
	}, []);

	return (
		<div className="w-full">
			<div className="relative overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_18px_50px_-32px_rgba(0,0,0,0.2)]">
				<div
					className="flex transition-transform duration-700 ease-in-out"
					style={{ transform: `translateX(-${activeIndex * 100}%)` }}
				>
					{mockups.map((mockup) => (
						<div key={mockup.key} className="w-full shrink-0">
							<Image
								src={mockup.src}
								alt={mockup.alt}
								width={mockup.width}
								height={mockup.height}
								sizes="(min-width: 1024px) 900px, 100vw"
								className="h-auto w-full object-contain"
								priority={mockup.key === "unified-stream"}
							/>
						</div>
					))}
				</div>
			</div>

			<div className="mt-6 flex items-center justify-center gap-2">
				{mockups.map((mockup, index) => (
					<button
						key={mockup.key}
						type="button"
						onClick={() => setActiveIndex(index)}
						aria-label={`Show slide ${index + 1}`}
						aria-current={index === activeIndex}
						className={cn(
							"h-2 rounded-full transition-all duration-300",
							index === activeIndex
								? "w-6 bg-primary"
								: "w-2 bg-border hover:bg-border-strong",
						)}
					/>
				))}
			</div>
		</div>
	);
}
