import { describe, expect, it } from "vitest";
import { labelNamesFromActions } from "./rule-labels";

describe("labelNamesFromActions", () => {
	it("extracts the label name from a LABEL action", () => {
		expect(
			labelNamesFromActions([
				{ type: "LABEL", fields: { label: "Newsletter" } },
			]),
		).toEqual(["Newsletter"]);
	});

	it("returns multiple labels across multiple LABEL actions", () => {
		expect(
			labelNamesFromActions([
				{ type: "LABEL", fields: { label: "Finance" } },
				{ type: "ARCHIVE" },
				{ type: "LABEL", fields: { label: "Urgent" } },
			]),
		).toEqual(["Finance", "Urgent"]);
	});

	it("ignores non-LABEL actions", () => {
		expect(
			labelNamesFromActions([{ type: "ARCHIVE" }, { type: "MARK_READ" }]),
		).toEqual([]);
	});

	it("trims whitespace and drops empty label names", () => {
		expect(
			labelNamesFromActions([
				{ type: "LABEL", fields: { label: "  Spaced  " } },
				{ type: "LABEL", fields: { label: "   " } },
				{ type: "LABEL", fields: { label: "" } },
			]),
		).toEqual(["Spaced"]);
	});

	it("skips LABEL actions with a missing or non-string label", () => {
		expect(
			labelNamesFromActions([
				{ type: "LABEL", fields: {} },
				{ type: "LABEL" },
				{ type: "LABEL", fields: { label: 42 } },
			]),
		).toEqual([]);
	});

	it("returns [] for non-array / malformed input", () => {
		expect(labelNamesFromActions(null)).toEqual([]);
		expect(labelNamesFromActions(undefined)).toEqual([]);
		expect(labelNamesFromActions("not-an-array")).toEqual([]);
		expect(labelNamesFromActions([null, 5, "x"])).toEqual([]);
	});
});
