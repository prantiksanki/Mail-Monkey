"use client";

import { authClient } from "@repo/auth/client";
import { Spinner } from "@repo/ui";
import { useSession } from "@saas/auth/hooks/use-session";
import { UserAvatar } from "@shared/components/UserAvatar";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import { type HTMLAttributes, useState } from "react";
import { useDropzone } from "react-dropzone";
import { CropImageDialog } from "./CropImageDialog";

export function UserAvatarUpload({
	onSuccess,
	onError,
}: {
	onSuccess: () => void;
	onError: () => void;
}) {
	const { user, reloadSession } = useSession();
	const [uploading, setUploading] = useState(false);
	const [cropDialogOpen, setCropDialogOpen] = useState(false);
	const [image, setImage] = useState<File | null>(null);

	const getSignedUploadUrlMutation = useMutation(
		orpc.users.avatarUploadUrl.mutationOptions(),
	);

	const { getRootProps, getInputProps } = useDropzone({
		onDrop: (acceptedFiles) => {
			setImage(acceptedFiles[0]);
			setCropDialogOpen(true);
		},
		accept: {
			"image/png": [".png"],
			"image/jpeg": [".jpg", ".jpeg"],
		},
		multiple: false,
	});

	if (!user) {
		return null;
	}
	const onCrop = async (croppedImageData: Blob | null) => {
		if (!croppedImageData) {
			return;
		}

		setUploading(true);
		try {
			const { signedUploadUrl, path } =
				await getSignedUploadUrlMutation.mutateAsync({});

			const response = await fetch(signedUploadUrl, {
				method: "PUT",
				body: croppedImageData,
				headers: {
					"Content-Type": "image/png",
					// Required by Azure Blob Storage when uploading to a blob SAS
					// URL. Ignored by S3, so it is safe to always send.
					"x-ms-blob-type": "BlockBlob",
				},
			});

			if (!response.ok) {
				throw new Error("Failed to upload image");
			}

			// Append a cache-busting version so the stored image URL changes on
			// every upload. The avatar storage path is always `${user.id}.png`,
			// so without this the URL would be identical and the browser/proxy
			// would keep serving the previously cached image.
			const versionedPath = `${path}?v=${Date.now()}`;

			const { error } = await authClient.updateUser({
				image: versionedPath,
			});

			if (error) {
				throw error;
			}

			await reloadSession();

			onSuccess();
		} catch {
			onError();
		} finally {
			setUploading(false);
		}
	};

	return (
		<>
			<div
				className="relative size-24 rounded-full"
				{...(getRootProps() as HTMLAttributes<HTMLDivElement>)}
			>
				<input {...getInputProps()} />
				<UserAvatar
					className="size-24 cursor-pointer text-xl"
					avatarUrl={user.image}
					name={user.name ?? ""}
				/>

				{uploading && (
					<div className="absolute inset-0 z-20 flex items-center justify-center bg-card/90">
						<Spinner className="size-6" />
					</div>
				)}
			</div>

			<CropImageDialog
				image={image}
				open={cropDialogOpen}
				onOpenChange={setCropDialogOpen}
				onCrop={onCrop}
			/>
		</>
	);
}
