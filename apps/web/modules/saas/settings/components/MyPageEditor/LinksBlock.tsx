"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@repo/ui";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import {
	CheckIcon,
	CopyIcon,
	GripVerticalIcon,
	MailIcon,
	StarIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { PLATFORM_META, PLATFORM_ORDER } from "./platforms";
import type { LinkRow, Platform } from "./types";

function LinkRowEditor({
	row,
	onChange,
	onDelete,
	onFeature,
}: {
	row: LinkRow;
	onChange: (row: LinkRow) => void;
	onDelete: () => void;
	onFeature: () => void;
}) {
	const { attributes, listeners, setNodeRef, transform, transition } =
		useSortable({ id: row.id });
	const [copied, setCopied] = useState(false);

	const onCopy = async () => {
		if (row.type === "contact-form" || !row.url) {
			return;
		}
		try {
			await navigator.clipboard.writeText(row.url);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// clipboard API unavailable — no-op
		}
	};

	const setPlatform = (platform: Platform) => {
		const meta = PLATFORM_META[platform];
		const wasDefaultLabel =
			row.label === "" || row.label === PLATFORM_META[row.platform].label;
		onChange({
			...row,
			platform,
			label: wasDefaultLabel ? meta.label : row.label,
		});
	};

	return (
		<div
			ref={setNodeRef}
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
			}}
			className="rounded-xl border border-border bg-card p-3 shadow-sm"
		>
			<div className="flex items-center gap-2">
				<button
					type="button"
					aria-label="Drag to reorder link"
					className="cursor-grab touch-none text-foreground/30 hover:text-foreground/60 active:cursor-grabbing"
					{...attributes}
					{...listeners}
				>
					<GripVerticalIcon className="size-4" />
				</button>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="flex size-8 shrink-0 items-center justify-center gap-0.5 rounded-lg bg-muted hover:bg-muted/70"
							aria-label="Choose platform"
						>
							{row.type === "contact-form" ? (
								<MailIcon className="size-4 text-foreground/60" />
							) : (
								PLATFORM_META[row.platform].icon("size-4")
							)}
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						{PLATFORM_ORDER.map((platform) => (
							<DropdownMenuItem
								key={platform}
								onClick={() => {
									onChange({ ...row, type: "url" });
									setPlatform(platform);
								}}
								className="gap-2"
							>
								{PLATFORM_META[platform].icon("size-3.5")}
								{PLATFORM_META[platform].label}
							</DropdownMenuItem>
						))}
						<DropdownMenuItem
							onClick={() =>
								onChange({
									...row,
									type: "contact-form",
									label:
										row.label === ""
											? "Get in touch"
											: row.label,
								})
							}
							className="gap-2"
						>
							<MailIcon className="size-3.5" />
							Open contact form
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>

				<div className="min-w-0 flex-1">
					<Input
						value={row.label}
						onChange={(e) =>
							onChange({ ...row, label: e.target.value })
						}
						placeholder="Label"
						className="h-7 border-none px-0 font-semibold text-sm shadow-none focus-visible:ring-0"
					/>
					{row.type === "contact-form" ? (
						<p className="truncate text-foreground/50 text-xs">
							Opens contact form
						</p>
					) : (
						<Input
							value={row.url}
							onChange={(e) =>
								onChange({ ...row, url: e.target.value })
							}
							placeholder={
								PLATFORM_META[row.platform].placeholder
							}
							className="h-6 border-none px-0 text-foreground/50 text-xs shadow-none focus-visible:ring-0"
						/>
					)}
				</div>

				<Switch
					checked={row.enabled}
					onCheckedChange={(enabled) => onChange({ ...row, enabled })}
				/>
			</div>

			<div className="mt-2 flex items-center gap-1 border-border/70 border-t pt-2 pl-9">
				<button
					type="button"
					onClick={onFeature}
					aria-label="Mark as featured"
					className={cn(
						"flex size-7 items-center justify-center rounded-md text-foreground/40 hover:bg-muted hover:text-[#4F46E5]",
						row.featured && "text-[#4F46E5]",
					)}
					title="Feature this link"
				>
					<StarIcon
						className="size-4"
						fill={row.featured ? "#4F46E5" : "none"}
					/>
				</button>

				{row.type !== "contact-form" && (
					<button
						type="button"
						onClick={onCopy}
						aria-label="Copy link URL"
						className="flex size-7 items-center justify-center rounded-md text-foreground/40 hover:bg-muted hover:text-foreground/70"
						title="Copy link"
					>
						{copied ? (
							<CheckIcon className="size-4" />
						) : (
							<CopyIcon className="size-4" />
						)}
					</button>
				)}

				<button
					type="button"
					onClick={onDelete}
					aria-label="Delete link"
					className="ml-auto flex size-7 items-center justify-center rounded-md text-foreground/40 hover:bg-muted hover:text-destructive"
					title="Delete link"
				>
					<Trash2Icon className="size-4" />
				</button>
			</div>
		</div>
	);
}

export function newLinkRow(platform: Platform, links: LinkRow[]): LinkRow {
	return {
		id: crypto.randomUUID(),
		type: "url",
		platform,
		label: PLATFORM_META[platform].label,
		url: "",
		enabled: true,
		featured: links.length === 0,
	};
}

export function newContactFormRow(links: LinkRow[]): LinkRow {
	return {
		id: crypto.randomUUID(),
		type: "contact-form",
		platform: "custom",
		label: "Message me",
		url: "",
		enabled: true,
		featured: links.length === 0,
	};
}

export function LinksBlock({
	links,
	onChange,
}: {
	links: LinkRow[];
	onChange: (links: LinkRow[]) => void;
}) {
	const sensors = useSensors(useSensor(PointerSensor));

	const onDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) {
			return;
		}
		const oldIndex = links.findIndex((l) => l.id === active.id);
		const newIndex = links.findIndex((l) => l.id === over.id);
		onChange(arrayMove(links, oldIndex, newIndex));
	};

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragEnd={onDragEnd}
		>
			<SortableContext
				items={links.map((l) => l.id)}
				strategy={verticalListSortingStrategy}
			>
				<div className="flex flex-col gap-2">
					{links.map((row) => (
						<LinkRowEditor
							key={row.id}
							row={row}
							onChange={(next) =>
								onChange(
									links.map((l) =>
										l.id === next.id ? next : l,
									),
								)
							}
							onDelete={() =>
								onChange(links.filter((l) => l.id !== row.id))
							}
							onFeature={() =>
								onChange(
									links.map((l) => ({
										...l,
										featured:
											l.id === row.id && !l.featured,
									})),
								)
							}
						/>
					))}
				</div>
			</SortableContext>
		</DndContext>
	);
}
