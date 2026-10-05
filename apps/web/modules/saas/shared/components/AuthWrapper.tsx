import { config } from "@repo/i18n/config";
import { cn, Logo } from "@repo/ui";
import { AuthAside } from "@saas/shared/components/AuthAside";
import { ColorModeToggle } from "@shared/components/ColorModeToggle";
import { LocaleSwitch } from "@shared/components/LocaleSwitch";
import Link from "next/link";
import { type PropsWithChildren, Suspense } from "react";

export function AuthWrapper({
	children,
	contentClass,
}: PropsWithChildren<{ contentClass?: string }>) {
	return (
		<div className="flex min-h-screen w-full bg-[radial-gradient(circle_at_top,var(--primary-soft),transparent_24%),linear-gradient(180deg,var(--background)_0%,var(--muted)_100%)] text-foreground">
			<div className="flex flex-1 flex-col">
				<div className="flex items-center justify-between px-6 py-6 md:px-10">
					<Link href="/" className="block">
						<Logo />
					</Link>

					<div className="flex items-center justify-end gap-2">
						{Object.keys(config.locales).length > 1 && (
							<Suspense>
								<LocaleSwitch withLocaleInUrl={false} />
							</Suspense>
						)}
						<ColorModeToggle />
					</div>
				</div>

				<div className="flex flex-1 items-center justify-center px-6 pb-10 md:px-10">
					<main className={cn("w-full max-w-md", contentClass)}>
						{children}
					</main>
				</div>
			</div>

			<AuthAside />
		</div>
	);
}
