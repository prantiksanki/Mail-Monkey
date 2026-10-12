import { ORPCError } from "@orpc/client";
import { getDirectoryTags as getDirectoryTagsQuery } from "@repo/database";
import { logger } from "@repo/logs";
import { publicProcedure } from "../../../orpc/procedures";

export const getDirectoryTags = publicProcedure
	.route({
		method: "GET",
		path: "/creator-profiles/directory/tags",
		tags: ["Creator Profiles"],
		summary: "Get all tags currently in use in the public directory",
	})
	.handler(async () => {
		try {
			return await getDirectoryTagsQuery();
		} catch (error) {
			logger.error("Failed to fetch directory tags", { error });
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
