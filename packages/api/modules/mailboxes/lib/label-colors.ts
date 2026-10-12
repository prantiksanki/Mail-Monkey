/**
 * Label colour palette shared between ZeroMail's sidebar and Gmail.
 *
 * Gmail's `users.labels` API only accepts `color.backgroundColor` /
 * `color.textColor` values from a fixed, documented palette — arbitrary hex
 * codes are rejected with a 400. To keep the colour a user sees in ZeroMail
 * identical to the one Gmail renders, we pick label colours *only* from this
 * palette, and send the matching `textColor` Gmail expects for each background.
 *
 * Palette + text pairings mirror Gmail's own label picker. See:
 * https://developers.google.com/gmail/api/reference/rest/v1/users.labels#color
 */

export interface LabelColor {
	/** Gmail-allowed background hex. Also used as the ZeroMail sidebar dot. */
	backgroundColor: string;
	/** The textColor Gmail pairs with this background (also from the palette). */
	textColor: string;
}

/**
 * Ordered list of Gmail-allowed colours we assign labels to. Every
 * backgroundColor / textColor here is a valid Gmail palette value, so a label
 * created with any of these will render the same colour in Gmail as in ZeroMail.
 */
export const LABEL_COLORS: LabelColor[] = [
	{ backgroundColor: "#fb4c2f", textColor: "#ffffff" }, // red
	{ backgroundColor: "#ffad47", textColor: "#ffffff" }, // orange
	{ backgroundColor: "#fad165", textColor: "#000000" }, // yellow
	{ backgroundColor: "#16a766", textColor: "#ffffff" }, // green
	{ backgroundColor: "#4a86e8", textColor: "#ffffff" }, // blue
	{ backgroundColor: "#a479e2", textColor: "#ffffff" }, // purple
	{ backgroundColor: "#f691b3", textColor: "#000000" }, // pink
	{ backgroundColor: "#2da2bb", textColor: "#ffffff" }, // teal
	{ backgroundColor: "#b99aff", textColor: "#000000" }, // lavender
	{ backgroundColor: "#8a63d2", textColor: "#ffffff" }, // deep purple
];

/**
 * Deterministically maps a label name to one of the Gmail-allowed colours.
 * Same name → same colour, always, on both the ZeroMail and Gmail sides.
 * This must stay byte-for-byte identical to the hashing used in the web
 * sidebar so the two never drift.
 */
export function labelColorForName(name: string): LabelColor {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}
	return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length];
}
