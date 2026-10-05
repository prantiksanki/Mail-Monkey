import { describe, expect, it } from "vitest";
import {
	RULE_TEMPLATE_CATEGORIES,
	RULE_TEMPLATES,
	type RuleTemplateCategory,
} from "./rule-templates";

const VALID_CATEGORIES = new Set<RuleTemplateCategory>(
	RULE_TEMPLATE_CATEGORIES,
);

const VALID_ACTION_TYPES = new Set([
	"ARCHIVE",
	"LABEL",
	"MARK_READ",
	"FORWARD",
	"REPLY",
	"DRAFT_EMAIL",
	"MARK_SPAM",
]);

describe("RULE_TEMPLATES", () => {
	it("has at least one template", () => {
		expect(RULE_TEMPLATES.length).toBeGreaterThan(0);
	});

	it("every template has a unique id", () => {
		const ids = RULE_TEMPLATES.map((t) => t.id);
		const uniqueIds = new Set(ids);
		expect(uniqueIds.size).toBe(ids.length);
	});

	it("every template has a unique name", () => {
		const names = RULE_TEMPLATES.map((t) => t.name);
		const uniqueNames = new Set(names);
		expect(uniqueNames.size).toBe(names.length);
	});

	it("every template has a non-empty description", () => {
		for (const template of RULE_TEMPLATES) {
			expect(template.description.trim().length).toBeGreaterThan(0);
		}
	});

	it("every template belongs to a valid category", () => {
		for (const template of RULE_TEMPLATES) {
			expect(
				VALID_CATEGORIES.has(template.category as RuleTemplateCategory),
			).toBe(true);
		}
	});

	it("every template has a non-empty icon string", () => {
		for (const template of RULE_TEMPLATES) {
			expect(typeof template.icon).toBe("string");
			expect(template.icon.trim().length).toBeGreaterThan(0);
		}
	});

	it("every template rule has a name matching the template name", () => {
		for (const template of RULE_TEMPLATES) {
			expect(template.rule.name).toBe(template.name);
		}
	});

	it("every template rule has enabled: true", () => {
		for (const template of RULE_TEMPLATES) {
			expect(template.rule.enabled).toBe(true);
		}
	});

	it("every template has at least one action", () => {
		for (const template of RULE_TEMPLATES) {
			expect(template.rule.actions.length).toBeGreaterThan(0);
		}
	});

	it("every action type is a known value", () => {
		for (const template of RULE_TEMPLATES) {
			for (const action of template.rule.actions) {
				expect(VALID_ACTION_TYPES.has(action.type)).toBe(true);
			}
		}
	});

	it("LABEL actions have a non-empty label field", () => {
		for (const template of RULE_TEMPLATES) {
			for (const action of template.rule.actions) {
				if (action.type === "LABEL") {
					expect(action.fields?.label?.trim().length).toBeGreaterThan(
						0,
					);
				}
			}
		}
	});

	it("every template has either aiInstructions or static condition fields", () => {
		for (const template of RULE_TEMPLATES) {
			const { condition } = template.rule;
			const hasAi =
				condition.aiInstructions &&
				condition.aiInstructions.trim().length > 0;
			const hasStatic =
				condition.static &&
				Object.values(condition.static).some(
					(v) => typeof v === "string" && v.trim().length > 0,
				);
			expect(hasAi || hasStatic).toBe(true);
		}
	});
});

describe("RULE_TEMPLATE_CATEGORIES", () => {
	it("always includes 'All' as the first entry", () => {
		expect(RULE_TEMPLATE_CATEGORIES[0]).toBe("All");
	});

	it("every non-All category has at least one matching template", () => {
		const usedCategories = new Set(RULE_TEMPLATES.map((t) => t.category));
		for (const category of RULE_TEMPLATE_CATEGORIES) {
			if (category === "All") {
				continue;
			}
			expect(usedCategories.has(category)).toBe(true);
		}
	});
});
