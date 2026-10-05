"use client";

import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/ui/components/table";
import { useTranslations } from "next-intl";

interface TopSendersTableProps {
	senders: Array<{ sender: string; count: number }>;
	isLoading: boolean;
}

export function TopSendersTable({ senders, isLoading }: TopSendersTableProps) {
	const t = useTranslations();

	if (isLoading) {
		return <Skeleton className="h-64" />;
	}

	if (senders.length === 0) {
		return null;
	}

	const maxCount = senders.length > 0 ? senders[0].count : 1;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("analytics.topEmailSenders")}</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-12">#</TableHead>
							<TableHead>{t("analytics.sender")}</TableHead>
							<TableHead className="w-32 text-right">
								{t("analytics.count")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{senders.map((sender, index) => (
							<TableRow key={sender.sender}>
								<TableCell className="text-muted-foreground font-medium">
									{index + 1}
								</TableCell>
								<TableCell>
									<div className="flex items-center gap-3">
										<div
											className="h-2 rounded-full bg-primary/80"
											style={{
												width: `${Math.max((sender.count / maxCount) * 100, 8)}%`,
												maxWidth: "60%",
											}}
										/>
										<span className="truncate text-sm">
											{sender.sender}
										</span>
									</div>
								</TableCell>
								<TableCell className="text-right">
									<Badge status="info">{sender.count}</Badge>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
