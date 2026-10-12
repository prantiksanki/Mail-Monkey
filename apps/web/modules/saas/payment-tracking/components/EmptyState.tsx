import { InboxIcon } from "lucide-react";

export function EmptyState() {
	return (
		<div className="rounded-2xl border border-border border-dashed bg-muted/20 px-6 py-16 text-center">
			<InboxIcon className="mx-auto size-8 text-muted-foreground" />
			<h2 className="mt-4 font-serif font-normal text-2xl tracking-tight">
				No payments yet
			</h2>
			<p className="mx-auto mt-2 max-w-md text-foreground text-sm">
				We'll automatically organize bills, invoices, subscriptions, and
				payment emails here.
			</p>
		</div>
	);
}
