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
		return buildSasUrl(path, bucket, permissions, expiresIn ?? 60 * 60);
	} catch (e) {
		logger.error(e);

		throw new Error("Could not get signed url");
	}
};
