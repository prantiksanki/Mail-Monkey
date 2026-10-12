import {
	GetSecretValueCommand,
	SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

/**
 * Resolves a config value either from a plaintext env var (local dev) or by
 * fetching it from AWS Secrets Manager (production, using the EC2 instance's
 * attached IAM role via the default credential provider chain).
 */
export async function resolveSecret(
	plainEnvVar: string,
	secretIdEnvVar: string,
): Promise<string> {
	const plain = process.env[plainEnvVar];
	if (plain) {
		return plain;
	}

	const secretId = process.env[secretIdEnvVar];
	if (!secretId) {
		throw new Error(
			`Set either ${plainEnvVar} (plaintext, local dev) or ${secretIdEnvVar} ` +
				"(Secrets Manager secret name/ARN, production) before starting the server.",
		);
	}

	const client = new SecretsManagerClient({});
	const result = await client.send(
		new GetSecretValueCommand({ SecretId: secretId }),
	);

	if (!result.SecretString) {
		throw new Error(`Secret ${secretId} has no SecretString value.`);
	}

	return result.SecretString;
}
