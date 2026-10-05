import * as SecureStore from "@/lib/secure-store";

const KEY = "payment_apps";

export type UpiApp = "gpay" | "phonepe" | "paytm";

export const UPI_APPS: {
	id: UpiApp;
	name: string;
	color: string;
	initial: string;
	// Android deep-link scheme, used later to jump from a payment email.
	scheme: string;
}[] = [
	{ id: "gpay", name: "Google Pay", color: "#1a73e8", initial: "G", scheme: "tez://upi/pay" },
	{ id: "phonepe", name: "PhonePe", color: "#5f259f", initial: "P", scheme: "phonepe://pay" },
	{ id: "paytm", name: "Paytm", color: "#00baf2", initial: "P", scheme: "paytmmp://pay" },
];

export async function getPaymentApps(): Promise<UpiApp[]> {
	const v = await SecureStore.getItemAsync(KEY);
	try {
		return v ? (JSON.parse(v) as UpiApp[]) : [];
	} catch {
		return [];
	}
}

export async function setPaymentApps(apps: UpiApp[]): Promise<void> {
	await SecureStore.setItemAsync(KEY, JSON.stringify(apps));
}
