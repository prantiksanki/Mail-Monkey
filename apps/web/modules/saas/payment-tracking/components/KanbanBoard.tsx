"use client";

import {
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@repo/ui";
import { Input } from "@repo/ui/components/input";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useMailboxesQuery } from "@saas/mailboxes/lib/api";
import {
	PAYMENT_TYPE_LABELS,
	PAYMENT_TYPES,
	type PaymentCardFilters,
	type PaymentCardListItem,
	type PaymentKanbanStatus,
	type PaymentType,
	usePaymentCardsQuery,
	useUpdatePaymentCardStatusMutation,
} from "@saas/payment-tracking/lib/payment-tracking-api";
import { useMemo, useState } from "react";
import { EmptyState } from "./EmptyState";
import { PaymentCard } from "./PaymentCard";
import { PaymentDetailDialog } from "./PaymentDetailDialog";

const COLUMNS: { status: PaymentKanbanStatus; label: string }[] = [
	{ status: "UPCOMING", label: "Upcoming" },
	{ status: "DUE_SOON", label: "Due Soon" },
	{ status: "OVERDUE", label: "Overdue" },
	{ status: "PAID", label: "Paid" },
];

function Column({
	status,
	label,
	cards,
	onOpen,
	index,
}: {
	status: PaymentKanbanStatus;
	label: string;
	cards: PaymentCardListItem[];
	onOpen: (id: string) => void;
	index: number;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: status });

	// Vertical divider between columns, matching the original board's rule
	// lines — skipped on the first column of each visual row (col 1 of the
	// 2-col wrap, and col 1/3 of the 4-col row on xl+ screens).
	const isRowStart = index % 2 === 0;
	const isXlRowStart = index % 4 === 0;

	return (
		<div
			className={cn(
				"flex min-h-0 min-w-0 flex-col border-border",
				isRowStart ? "border-l-0 pl-0" : "border-l pl-4",
				isXlRowStart ? "xl:border-l-0 xl:pl-0" : "xl:border-l xl:pl-4",
			)}
		>
			<div className="mb-2 flex items-center gap-2 px-1">
				<h2 className="text-sm font-semibold text-foreground">
					{label}
				</h2>
				<span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
					{cards.length}
				</span>
			</div>
			<div
				ref={setNodeRef}
				className={cn(
					"flex-1 space-y-2 rounded-lg border border-border bg-muted/20 p-2 transition-colors",
					isOver && "bg-muted/50 border-primary/40",
				)}
			>
				<SortableContext
					items={cards.map((c) => c.id)}
					strategy={verticalListSortingStrategy}
				>
					{cards.length === 0 ? (
						<div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
							No cards
						</div>
					) : (
						cards.map((card) => (
							<PaymentCard
								key={card.id}
								card={card}
								onOpen={onOpen}
							/>
						))
					)}
				</SortableContext>
			</div>
		</div>
	);
}

function BoardSkeleton() {
	return (
		<div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
			{COLUMNS.map((col) => (
				<div key={col.status} className="space-y-2">
					<Skeleton className="h-5 w-24" />
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full" />
				</div>
			))}
		</div>
	);
}

export function KanbanBoard() {
	const [mailboxId, setMailboxId] = useState<string | undefined>(undefined);
	const [paymentType, setPaymentType] = useState<PaymentType | undefined>(
		undefined,
	);
	const [search, setSearch] = useState("");
	const [openCardId, setOpenCardId] = useState<string | null>(null);
	const [activeCardId, setActiveCardId] = useState<string | null>(null);

	const { data: mailboxes = [] } = useMailboxesQuery();

	const filters: PaymentCardFilters = useMemo(
		() => ({
			mailboxId,
			paymentType,
			search: search.trim() || undefined,
		}),
		[mailboxId, paymentType, search],
	);

	const { data, isLoading } = usePaymentCardsQuery(filters);
	const updateStatusMutation = useUpdatePaymentCardStatusMutation(filters);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 5 },
		}),
	);

	const cardsByColumn = useMemo(() => {
		const grouped: Record<PaymentKanbanStatus, PaymentCardListItem[]> = {
			UPCOMING: [],
			DUE_SOON: [],
			OVERDUE: [],
			PAID: [],
		};
		for (const card of data?.cards ?? []) {
			grouped[card.kanbanStatus].push(card);
		}
		return grouped;
	}, [data?.cards]);

	const hasAnyCards = (data?.cards.length ?? 0) > 0;
	const activeCard = data?.cards.find((c) => c.id === activeCardId);

	const COLUMN_STATUSES = new Set(COLUMNS.map((c) => c.status));

	const handleDragStart = (event: DragStartEvent) => {
		setActiveCardId(String(event.active.id));
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over) {
			setActiveCardId(null);
			return;
		}
		// A drop can land either on the column container itself (over.id is the
		// column's status) or on another card inside it (over.id is that card's
		// id, since each card is also a sortable drop target) — resolve to the
		// owning column's status either way.
		const overId = String(over.id);
		const newStatus = COLUMN_STATUSES.has(overId as PaymentKanbanStatus)
			? (overId as PaymentKanbanStatus)
			: data?.cards.find((c) => c.id === overId)?.kanbanStatus;
		const card = data?.cards.find((c) => c.id === active.id);
		if (!newStatus || !card || card.kanbanStatus === newStatus) {
			setActiveCardId(null);
			return;
		}
		// Trigger the optimistic cache patch (onMutate runs synchronously
		// within this call) before clearing activeCardId, so the underlying
		// sortable card is already re-parented into its new column by the
		// time the DragOverlay unmounts — otherwise it briefly flashes back
		// at its old position for one render.
		updateStatusMutation.mutate({ id: card.id, kanbanStatus: newStatus });
		setActiveCardId(null);
	};

	return (
		<div className="flex h-full flex-col gap-4 p-6">
			<div>
				<h1 className="font-serif text-2xl font-normal tracking-tight">
					Payments
				</h1>
				<p className="text-sm text-muted-foreground">
					Bills, invoices, and payment emails across all your
					connected accounts.
				</p>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<Input
					placeholder="Search merchant or subject…"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="max-w-xs"
				/>
				<select
					value={mailboxId ?? ""}
					onChange={(e) => setMailboxId(e.target.value || undefined)}
					className="h-9 rounded-md border border-border bg-background px-3 text-sm"
				>
					<option value="">All mailboxes</option>
					{mailboxes.map((mailbox) => (
						<option key={mailbox.id} value={mailbox.id}>
							{mailbox.provider === "GOOGLE"
								? "Gmail"
								: "Outlook"}{" "}
							· {mailbox.email}
						</option>
					))}
				</select>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<button
					type="button"
					onClick={() => setPaymentType(undefined)}
					className={cn(
						"rounded-full border px-3 py-1 text-xs font-medium transition-colors",
						paymentType === undefined
							? "border-primary bg-primary/10 text-primary-deep"
							: "border-border bg-card text-foreground hover:bg-muted",
					)}
				>
					All
				</button>
				{PAYMENT_TYPES.map((type) => (
					<button
						key={type}
						type="button"
						onClick={() =>
							setPaymentType((current) =>
								current === type ? undefined : type,
							)
						}
						className={cn(
							"rounded-full border px-3 py-1 text-xs font-medium transition-colors",
							paymentType === type
								? "border-primary bg-primary/10 text-primary-deep"
								: "border-border bg-card text-foreground hover:bg-muted",
						)}
					>
						{PAYMENT_TYPE_LABELS[type]}
					</button>
				))}
			</div>

			{isLoading ? (
				<BoardSkeleton />
			) : !hasAnyCards ? (
				<EmptyState />
			) : (
				<DndContext
					sensors={sensors}
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
					onDragCancel={() => setActiveCardId(null)}
				>
					<div className="grid flex-1 grid-cols-2 gap-4 overflow-y-auto xl:grid-cols-4">
						{COLUMNS.map((col, index) => (
							<Column
								key={col.status}
								status={col.status}
								label={col.label}
								cards={cardsByColumn[col.status]}
								onOpen={setOpenCardId}
								index={index}
							/>
						))}
					</div>
					<DragOverlay dropAnimation={null}>
						{activeCard ? (
							<PaymentCard
								card={activeCard}
								onOpen={() => {}}
								overlay
							/>
						) : null}
					</DragOverlay>
				</DndContext>
			)}

			<PaymentDetailDialog
				cardId={openCardId}
				onOpenChange={(open) => !open && setOpenCardId(null)}
			/>
		</div>
	);
}
