import type { ImageSourcePropType } from "react-native";
import { getPref, setPref } from "./prefs";

export type Slide = {
	key: string;
	title: string;
	image: ImageSourcePropType;
};

// Illustrations exported from Figma (file xicwhr38dw2KAx9MxbzNVU).
export const SLIDES: Slide[] = [
	{
		key: "writing",
		title: "Freedom of Writing",
		image: require("../assets/onboarding/slide1.png"),
	},
	{
		key: "peace",
		title: "Made for Peace.\nBuilt with Space.",
		image: require("../assets/onboarding/slide2.png"),
	},
	{
		key: "ai",
		title: "Boost Your Mind\nPower with AI",
		image: require("../assets/onboarding/slide3.jpg"),
	},
];

// DEV ONLY: preview the splash/onboarding/welcome flow even while logged in
// and already onboarded. Set back to false before shipping.
export const FORCE_ONBOARDING_PREVIEW = true;

const ONBOARDED_KEY = "hasOnboarded";

export function getOnboarded(): Promise<boolean> {
	return getPref(ONBOARDED_KEY, false);
}

export function setOnboarded(value: boolean): Promise<void> {
	return setPref(ONBOARDED_KEY, value);
}
