import {
	BlobSASPermissions,
	BlobServiceClient,
	generateBlobSASQueryParameters,
	StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { logger } from "@repo/logs";
import { config } from "../../config";
import type {
	GetSignedUploadUrlHandler,
	GetSignedUrlHander,
} from "../../types";

let sharedKeyCredential: StorageSharedKeyCredential | null = null;
let blobServiceClient: BlobServiceClient | null = null;

const getAzureConfig = () => {
	const accountName = process.env.AZURE_STORAGE_ACCOUNT as string;
	if (!accountName) {
		throw new Error("Missing env variable AZURE_STORAGE_ACCOUNT");
	}

	const accountKey = process.env.AZURE_STORAGE_KEY as string;
	if (!accountKey) {
		throw new Error("Missing env variable AZURE_STORAGE_KEY");
	}

	if (!sharedKeyCredential) {
		sharedKeyCredential = new StorageSharedKeyCredential(
			accountName,
			accountKey,
		);
	}

	if (!blobServiceClient) {
		blobServiceClient = new BlobServiceClient(
			`https://${accountName}.blob.core.windows.net`,
			sharedKeyCredential,
		);
	}

	return { accountName, sharedKeyCredential, blobServiceClient };
};

// Azure has no concept of "buckets"; the equivalent is a container. We reuse
// the configured bucket name as the container name so the storage interface
// stays identical to the S3 provider.
const getContainerName = (bucket: keyof typeof config.bucketNames) => {
	const containerName = config.bucketNames[bucket];

	if (!containerName) {
		throw new Error("Invalid bucket");
	}

	return containerName;
};

const buildSasUrl = (
	path: string,
	bucket: keyof typeof config.bucketNames,
	permissions: BlobSASPermissions,
	expiresInSeconds: number,
	responseOverrides?: { contentType?: string; contentDisposition?: string },
) => {
	const { accountName, sharedKeyCredential } = getAzureConfig();
	const containerName = getContainerName(bucket);

	const now = Date.now();
	const sas = generateBlobSASQueryParameters(
		{
			containerName,
			blobName: path,
			permissions,
			// Allow for minor clock skew between this server and Azure.
			startsOn: new Date(now - 5 * 60 * 1000),
			expiresOn: new Date(now + expiresInSeconds * 1000),
			// Response header overrides (rsct/rscd). Azure SAS has no way to
			// constrain what Content-Type a client's PUT is allowed to send on
			// upload — unlike S3 SigV4, the signature doesn't bind to that
			// header — so a blob can end up stored with an attacker-chosen
			// Content-Type (e.g. text/html, image/svg+xml with an embedded
			// <script>). These overrides are the mitigation: force a safe
			// Content-Type on every read through a SAS this app issues,
			// regardless of what was actually stored.
			contentType: responseOverrides?.contentType,
			contentDisposition: responseOverrides?.contentDisposition,
		},
		sharedKeyCredential,
	).toString();

	const encodedBlob = encodeURIComponent(path);

	return `https://${accountName}.blob.core.windows.net/${containerName}/${encodedBlob}?${sas}`;
};

export const getSignedUploadUrl: GetSignedUploadUrlHandler = async (
	path,
	{ bucket },
) => {
	try {
		// `c` (create) + `w` (write) are required to upload a new blob.
		const permissions = BlobSASPermissions.parse("cw");
		return buildSasUrl(path, bucket, permissions, 60);
	} catch (e) {
		logger.error(e);

		throw new Error("Could not get signed upload url");
	}
};

export const getSignedUrl: GetSignedUrlHander = async (
	path,
	{ bucket, expiresIn },
) => {
	try {
		const permissions = BlobSASPermissions.parse("r");
		// This app's only bucket ("avatars") holds profile photos, so every
		// read is pinned to image/jpeg and inline display — see the comment
		// in buildSasUrl for why this override exists. If this function is
		// ever reused for a bucket holding non-image content, these
		// hardcoded overrides need to become a caller-supplied parameter.
		return buildSasUrl(path, bucket, permissions, expiresIn ?? 60 * 60, {
			contentType: "image/jpeg",
			contentDisposition: "inline",
		});
	} catch (e) {
		logger.error(e);

		throw new Error("Could not get signed url");
	}
};
