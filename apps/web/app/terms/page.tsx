function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="mb-8">
			<h2 className="mb-3 font-semibold text-2xl">{title}</h2>
			<div className="space-y-3 text-base text-foreground/80 leading-7">
				{children}
			</div>
		</section>
	);
}

export default function TermsPage() {
	return (
		<div className="container max-w-4xl px-6 pt-24 pb-16">
			<div className="mx-auto max-w-3xl">
				<h1 className="mb-4 font-bold text-4xl">
					Terms and Conditions
				</h1>

				<Section title="Overview">
					<p>
						These Terms and Conditions govern your use of Zer0
						Email, a service operated by PopPush AI.
					</p>
				</Section>

				<Section title="Use of the Service">
					<p>
						You may use Zer0Email only in compliance with applicable
						laws and these terms. You are responsible for activity
						that occurs under your account.
					</p>
				</Section>

				<Section title="Accounts">
					<p>
						You are responsible for maintaining the security of your
						account and connected services. You must provide
						accurate information when using Zer0Email.
					</p>
				</Section>

				<Section title="Service Availability">
					<p>
						We may update, change, suspend, or discontinue parts of
						the service at any time. We do not guarantee
						uninterrupted or error-free service.
					</p>
				</Section>

				<Section title="Acceptable Use">
					<p>
						You may not use Zer0Email for unlawful, harmful,
						abusive, or unauthorized activity, including attempts to
						interfere with the service or access data without
						permission.
					</p>
				</Section>

				<Section title="Limitation of Liability">
					<p>
						To the maximum extent permitted by law, Zer0Email and
						PopPush AI are not liable for indirect, incidental,
						special, consequential, or punitive damages, or for loss
						of data, profits, or business opportunities arising from
						use of the service.
					</p>
				</Section>

				<Section title="Contact">
					<p>
						If you have questions about these terms, contact{" "}
						<a
							className="underline"
							href="mailto:founder@zer0email.com"
						>
							founder@zer0email.com
						</a>
						.
					</p>
				</Section>
			</div>
		</div>
	);
}
