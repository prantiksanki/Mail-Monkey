interface FaqItem {
	question: string;
	answer: string;
}

const faqItems: FaqItem[] = [
	{
		question: "Do you read my emails?",
		answer: "Rules run on your own mailbox via the Gmail API. We only look at subject lines, senders, and bodies when a condition requires it, and only for the length of the call. Nothing is stored on our servers.",
	},
	{
		question: 'What counts as an "email processed"?',
		answer: "Any incoming email that matches an active rule and triggers an action. Emails that don't match a rule don't count against your monthly quota.",
	},
	{
		question: "Which email providers does MailMonkey support?",
		answer: "Gmail and Outlook. You can connect multiple accounts across both providers and manage them all from one dashboard.",
	},
	{
		question: "How does the rule engine work?",
		answer: "You define rules using conditions (sender, subject, body keywords, date) and actions (label, archive, forward, reply, delete). Rules run automatically the moment a matching email arrives. You can also describe a rule in plain English and let the AI assistant set it up.",
	},
	{
		question: "Can I cancel or change my plan at any time?",
		answer: "Yes. You can upgrade, downgrade, or cancel at any time from billing settings. Your rules keep running until the end of the billing period.",
	},
];

export function FaqSection() {
	return (
		<section
			id="faq"
			className="w-full scroll-mt-24 bg-background px-6 py-20 text-center sm:px-8 sm:py-24"
		>
			<span className="mb-4 inline-block rounded-full bg-primary px-5 py-2 text-xs font-bold uppercase tracking-[0.3em] text-primary-foreground">
				FAQ
			</span>
			<div className="mb-2 font-sans text-[34px] font-normal leading-[1.02] tracking-tight text-foreground sm:text-[40px] md:text-[52px]">
				Frequently asked
				<br />
				questions.
			</div>
			<p className="mb-10 text-[18px] leading-[1.5] text-foreground">
				The short answers to the things people ask most.
			</p>

			<div className="mx-auto w-full max-w-[700px] space-y-3 text-left">
				{faqItems.map((item) => (
					<details
						key={item.question}
						className="group overflow-hidden rounded-[1.5rem] border border-border bg-card px-5 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.16)]"
					>
						<summary className="flex cursor-pointer list-none items-center justify-between py-5 text-[15px] font-semibold text-foreground [&::-webkit-details-marker]:hidden">
							{item.question}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
								aria-hidden="true"
							>
								<path d="m6 9 6 6 6-6" />
							</svg>
						</summary>
						<p className="pb-5 text-sm leading-[1.75] text-foreground">
							{item.answer}
						</p>
					</details>
				))}
			</div>
		</section>
	);
}
