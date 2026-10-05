import {
	Container,
	Font,
	Head,
	Html,
	Section,
	Tailwind,
} from "@react-email/components";
import { Logo } from "@repo/ui";
import React, { type PropsWithChildren } from "react";

export default function Wrapper({ children }: PropsWithChildren) {
	return (
		<Tailwind
			config={{
				theme: {
					extend: {
						colors: {
							border: "#D5DADF",
							input: "#D5DADF",
							ring: "#0D9488",
							background: "#F8FAFB",
							foreground: "#1A1D21",
							primary: {
								DEFAULT: "#0D9488",
								foreground: "#ffffff",
							},
							secondary: {
								DEFAULT: "#E8ECEF",
								foreground: "#1A1D21",
							},
							destructive: {
								DEFAULT: "#EF4444",
								foreground: "#ffffff",
							},
							success: {
								DEFAULT: "#0D9488",
								foreground: "#ffffff",
							},
							muted: {
								DEFAULT: "#EEF1F3",
								foreground: "#5F6872",
							},
							accent: {
								DEFAULT: "#E0F2F1",
								foreground: "#1A1D21",
							},
							popover: {
								DEFAULT: "#ffffff",
								foreground: "#1A1D21",
							},
							card: {
								DEFAULT: "#ffffff",
								foreground: "#1A1D21",
							},
						},
						borderRadius: {
							lg: "0.75rem",
							md: "calc(0.75rem - 2px)",
							sm: "calc(0.75rem - 4px)",
							DEFAULT: "0.75rem",
						},
					},
				},
			}}
		>
			<Html lang="en">
				<Head>
					<Font
						fontFamily="Inter"
						fallbackFontFamily="Arial"
						fontWeight={400}
						fontStyle="normal"
					/>
				</Head>
				<Section className="bg-background p-4">
					<Container className="rounded-lg bg-card p-6 text-card-foreground">
						<Logo />
						{children}
					</Container>
				</Section>
			</Html>
		</Tailwind>
	);
}
