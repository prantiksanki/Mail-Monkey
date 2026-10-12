"use client";

import { Spinner } from "@repo/ui";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@repo/ui/components/avatar";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import { CameraIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { avatarSrc, type ProfileData } from "./types";
import { UsernameField } from "./UsernameField";

const BIO_MAX = 160;
// UX/abuse-reduction guard, not a security boundary — a scripted request can
// bypass this. The actual XSS/execution risk is closed server-side by always
// overriding the served Content-Type (see packages/storage's Azure provider).
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function initials(name: string) {
	return (
		name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? "")
			.join("") || "?"
	);
}

export function ProfileBlock({
	data,
	onChange,
}: {
	data: ProfileData;
	onChange: (data: ProfileData) => void;
}) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);

	const getSignedUploadUrlMutation = useMutation(
		orpc.creatorProfiles.photoUploadUrl.mutationOptions(),
	);

	// This is the public My Page photo, independent of the account avatar
	// (User.image, used in the nav bar/user menu) — it's stored under its own
	// `profile-${user.id}.png` path so it never overwrites the account one.
	// The upload happens immediately, but like every other field in this
	// editor, it's only persisted to the creator profile once the main Save
	// button is clicked (see useMyPageState.ts's onSave).
	const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) {
			return;
		}
		if (file.size > MAX_PHOTO_BYTES) {
			toast.error("Photo must be smaller than 5MB");
			return;
		}

		setUploading(true);
		try {
			const { signedUploadUrl, path } =
				await getSignedUploadUrlMutation.mutateAsync({});

			const response = await fetch(signedUploadUrl, {
				method: "PUT",
				body: file,
				headers: {
					"Content-Type": file.type || "image/png",
					// Required by Azure Blob Storage when uploading to a blob
					// SAS URL. Ignored by S3, so always safe to send.
					"x-ms-blob-type": "BlockBlob",
				},
			});

			if (!response.ok) {
				throw new Error("Failed to upload image");
			}

			// Cache-bust so the stored image URL changes on every upload —
			// the storage path is always `profile-${user.id}.png`.
			const versionedPath = `${path}?v=${Date.now()}`;

			onChange({ ...data, avatarUrl: versionedPath });
			toast.success("Photo uploaded — click Save to publish");
		} catch {
			toast.error("Couldn't upload photo");
		} finally {
			setUploading(false);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center gap-4">
				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					className="group relative"
					aria-label="Upload photo"
				>
					<Avatar className="size-16 rounded-full">
						{data.avatarUrl && (
							<AvatarImage src={avatarSrc(data.avatarUrl)} />
						)}
						<AvatarFallback className="rounded-full bg-[#EEF2FF] text-[#4F46E5] text-lg">
							{initials(data.displayName)}
						</AvatarFallback>
					</Avatar>
					<span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
						<CameraIcon className="size-5 text-white" />
					</span>
					{uploading && (
						<span className="absolute inset-0 flex items-center justify-center rounded-full bg-card/90">
							<Spinner className="size-5" />
						</span>
					)}
				</button>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					className="hidden"
					onChange={onPickPhoto}
				/>
				<div className="text-foreground/50 text-xs">
					Click the avatar to upload a photo
					<br />
					Shown on your public page only — your account avatar is
					unchanged.
				</div>
			</div>

			<div>
				<p className="mb-1.5 font-medium text-sm">Display name</p>
				<Input
					value={data.displayName}
					onChange={(e) =>
						onChange({ ...data, displayName: e.target.value })
					}
					placeholder="Your name"
				/>
				<p className="mt-1.5 text-foreground/50 text-xs">
					Shown on your public page only — defaults to your account
					name.
				</p>
			</div>

			<UsernameField
				username={data.username}
				onSaved={(username) => onChange({ ...data, username })}
			/>

			<div>
				<div className="mb-1.5 flex items-center justify-between">
					<p className="font-medium text-sm">Bio</p>
					<span
						className={`text-xs ${
							data.bio.length >= BIO_MAX
								? "text-destructive"
								: "text-foreground/40"
						}`}
					>
						{data.bio.length}/{BIO_MAX}
					</span>
				</div>
				<Textarea
					value={data.bio}
					maxLength={BIO_MAX}
					onChange={(e) => onChange({ ...data, bio: e.target.value })}
					placeholder="Tell visitors what you do"
					rows={3}
				/>
			</div>
		</div>
	);
}
