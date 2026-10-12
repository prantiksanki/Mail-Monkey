import { ORPCError } from "@orpc/client";
import { listDirectoryProfiles } from "@repo/database";
import { logger } from "@repo/logs";
import { publicProcedure } from "../../../orpc/procedures";
import { listDirectorySchema } from "../types";

export const listDirectory = publicProcedure
	.route({
		method: "GET",
		path: "/creator-profiles/directory",
		tags: ["Creator Profiles"],
		summary: "Browse the public creator/freelancer directory",
	})
	.input(listDirectorySchema)
	.handler(async ({ input }) => {
		try {
			return await listDirectoryProfiles(input);
		} catch (error) {
			logger.error("Failed to list directory", { error });
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
