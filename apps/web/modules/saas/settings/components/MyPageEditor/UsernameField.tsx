"use client";

import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import { CheckIcon } from "lucide-react";
import { useState } from "react";

export function UsernameField({
	username,
	onSaved,
}: {
	username: string;
	onSaved: (username: string) => void;
}) {
	const [value, setValue] = useState(username);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	const isDirty = value !== username;

	const onSave = async () => {
		const next = value.trim();
		if (!next || next === username) {
			return;
		}
		setSaving(true);
		setError(null);
		try {
			const { error: updateError } = await authClient.updateUser({
				username: next,
			});
			if (updateError) {
				setError(updateError.message ?? "Couldn't save that username.");
				return;
			}
			onSaved(next);
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
		} finally {
			setSaving(false);
		}
	};

	return (
		<div>
			<p className="mb-1.5 font-medium text-sm">Username</p>
			<div className="flex items-center gap-2">
				<div className="flex h-9 flex-1 items-center rounded-md border border-input bg-card px-3 text-sm">
					<span className="text-foreground/40">popsuites.ai/@</span>
					<input
						value={value}
						onChange={(e) => {
							setValue(
								e.target.value
									.replace(/[^a-zA-Z0-9_]/g, "")
									.toLowerCase(),
							);
							setError(null);
						}}
						placeholder="username"
						className="flex-1 bg-transparent outline-none"
					/>
				</div>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={onSave}
					disabled={!isDirty || !value || saving}
					loading={saving}
				>
					{saved ? <CheckIcon className="size-3.5" /> : null}
					{saved ? "Saved" : "Save"}
				</Button>
			</div>
			{error && <p className="mt-1 text-destructive text-xs">{error}</p>}
			{!username && !error && (
				<p className="mt-1 text-foreground/50 text-xs">
					Set a username to get your public page and booking link.
				</p>
			)}
		</div>
	);
}
