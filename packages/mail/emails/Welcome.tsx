import {
	Body,
	Container,
	Head,
	Html,
	Link,
	Section,
} from "@react-email/components";
import React from "react";
import { createTranslator } from "use-intl/core";
import type { BaseMailProps } from "../types";
import { defaultLocale, defaultTranslations } from "../util/translations";

const DARK = "#1a1a1a";
const fontFamily =
	"'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

export function Welcome({
	url,
	name,
	locale,
	translations,
}: {
	url: string;
	name: string;
} & BaseMailProps) {
	// Translator is wired up so the subject (mail.welcome.subject) resolves and
	// the template stays consistent with the other localized templates.
	createTranslator({ locale, messages: translations });

	return (
		<Html lang="en">
			<Head>
				<meta charSet="UTF-8" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1.0"
				/>
				<title>Welcome to Popsuites</title>
			</Head>
			<Body
				style={{
					margin: 0,
					padding: 0,
					backgroundColor: "#f7f7f5",
					fontFamily,
					fontSize: "15px",
					color: DARK,
				}}
			>
				<Container
					style={{
						maxWidth: "620px",
						margin: "0 auto",
						width: "100%",
					}}
				>
					{/* Preheader */}
					<table
						width="100%"
						cellPadding={0}
						cellSpacing={0}
						role="presentation"
					>
						<tbody>
							<tr>
								<td
									style={{
										padding: "12px 0",
										fontSize: "11px",
										color: "#999",
									}}
								>
									Welcome to a calmer inbox.
								</td>
								<td
									align="right"
									style={{
										padding: "12px 0",
										fontSize: "11px",
										color: "#999",
									}}
								>
									Not rendering?{" "}
									<Link
										href="https://zer0email.com/"
										style={{
											color: "#999",
											textDecoration: "underline",
										}}
									>
										View in browser
									</Link>
								</td>
							</tr>
						</tbody>
					</table>

					{/* Logo bar */}
					<table
						width="100%"
						cellPadding={0}
						cellSpacing={0}
						role="presentation"
						style={{ backgroundColor: DARK }}
					>
						<tbody>
							<tr>
								<td style={{ padding: "20px 32px" }}>
									<Link
										href="https://zer0email.com/"
										style={{ textDecoration: "none" }}
									>
										<table
											cellPadding={0}
											cellSpacing={0}
											role="presentation"
										>
											<tbody>
												<tr>
													<td
														style={{
															width: "28px",
															height: "28px",
															backgroundColor:
																"#fff",
															borderRadius: "6px",
															textAlign: "center",
															fontSize: "13px",
															fontWeight: 900,
															color: DARK,
														}}
													>
														Z0
													</td>
													<td
														style={{
															paddingLeft: "10px",
															fontSize: "15px",
															fontWeight: 700,
															color: "#fff",
														}}
													>
														Zer
														<span
															style={{
																color: "#aaa",
															}}
														>
															0
														</span>
														Email
													</td>
												</tr>
											</tbody>
										</table>
									</Link>
								</td>
							</tr>
						</tbody>
					</table>

					{/* Main card */}
					<Section
						style={{
							backgroundColor: "#fff",
							border: "1px solid #e8e8e6",
							borderTop: "none",
						}}
					>
						{/* Hero */}
						<table
							width="100%"
							cellPadding={0}
							cellSpacing={0}
							role="presentation"
						>
							<tbody>
								<tr>
									<td
										style={{
											padding: "52px 48px 40px",
											borderBottom: "1px solid #f0f0ee",
										}}
									>
										<div
											style={{
												fontSize: "11px",
												fontWeight: 600,
												letterSpacing: "0.08em",
												textTransform: "uppercase",
												color: "#888",
												marginBottom: "20px",
											}}
										>
											Welcome aboard
										</div>
										<h1
											style={{
												fontSize: "34px",
												fontWeight: 900,
												letterSpacing: "-0.03em",
												lineHeight: 1.12,
												color: DARK,
												margin: "0 0 20px",
											}}
										>
											Verify your
											<br />
											<span
												style={{ fontStyle: "italic" }}
											>
												inbox identity.
											</span>
										</h1>
										<p
											style={{
												fontSize: "14.5px",
												lineHeight: 1.7,
												color: "#555",
												maxWidth: "440px",
												margin: "0 0 32px",
											}}
										>
											Hi {name}, you're one step away from
											a smarter, calmer inbox. AI-powered
											rules, smart archiving, and
											automation — all waiting inside.
										</p>
										<Link
											href={url}
											style={{
												display: "inline-block",
												backgroundColor: DARK,
												color: "#fff",
												textDecoration: "none",
												fontSize: "13px",
												fontWeight: 600,
												padding: "13px 28px",
												borderRadius: "8px",
											}}
										>
											Confirm my email address
										</Link>
									</td>
								</tr>
							</tbody>
						</table>

						{/* Illustration section */}
						<table
							width="100%"
							cellPadding={0}
							cellSpacing={0}
							role="presentation"
						>
							<tbody>
								<tr>
									<td
										style={{
											padding: "40px 48px",
											borderBottom: "1px solid #f0f0ee",
										}}
									>
										<table
											cellPadding={0}
											cellSpacing={0}
											role="presentation"
										>
											<tbody>
												<tr>
													<td
														valign="top"
														style={{
															width: "180px",
														}}
													>
														{/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative email illustration */}
														<svg
															viewBox="0 0 180 160"
															fill="none"
															xmlns="http://www.w3.org/2000/svg"
															width="180"
															height="160"
														>
															<rect
																x="16"
																y="44"
																width="148"
																height="96"
																rx="8"
																fill="#f4f4f2"
																stroke="#d8d8d4"
																strokeWidth="1.5"
															/>
															<path
																d="M16,44 L90,100 L164,44"
																stroke="#c8c8c4"
																strokeWidth="1.5"
																fill="none"
																strokeLinejoin="round"
															/>
															<line
																x1="16"
																y1="140"
																x2="68"
																y2="96"
																stroke="#d0d0cc"
																strokeWidth="1"
															/>
															<line
																x1="164"
																y1="140"
																x2="112"
																y2="96"
																stroke="#d0d0cc"
																strokeWidth="1"
															/>
															<circle
																cx="90"
																cy="92"
																r="22"
																fill={DARK}
															/>
															<polyline
																points="80,92 87,100 102,84"
																stroke="#fff"
																strokeWidth="2.5"
																strokeLinecap="round"
																strokeLinejoin="round"
																fill="none"
															/>
															<circle
																cx="148"
																cy="60"
																r="2.5"
																fill="#d0d0cc"
															/>
															<circle
																cx="158"
																cy="60"
																r="2.5"
																fill="#d0d0cc"
															/>
															<circle
																cx="148"
																cy="70"
																r="2.5"
																fill="#d0d0cc"
															/>
															<circle
																cx="158"
																cy="70"
																r="2.5"
																fill="#d0d0cc"
															/>
															<circle
																cx="22"
																cy="108"
																r="2"
																fill="#d0d0cc"
															/>
															<circle
																cx="31"
																cy="108"
																r="2"
																fill="#d0d0cc"
															/>
															<circle
																cx="22"
																cy="117"
																r="2"
																fill="#d0d0cc"
															/>
															<circle
																cx="31"
																cy="117"
																r="2"
																fill="#d0d0cc"
															/>
														</svg>
													</td>
													<td
														valign="top"
														style={{
															paddingLeft: "32px",
														}}
													>
														<h2
															style={{
																fontSize:
																	"16px",
																fontWeight: 700,
																letterSpacing:
																	"-0.02em",
																color: DARK,
																margin: "0 0 10px",
															}}
														>
															What's waiting for
															you
														</h2>
														<p
															style={{
																fontSize:
																	"13.5px",
																lineHeight: 1.65,
																color: "#666",
																margin: "0 0 16px",
															}}
														>
															After confirming,
															you'll unlock your
															Popsuites workspace
															— a distraction-free
															environment built
															for how you actually
															think.
														</p>
														<p
															style={{
																fontSize:
																	"13.5px",
																lineHeight: 1.65,
																color: "#666",
																margin: "0 0 16px",
															}}
														>
															Connect Gmail or
															Outlook, set smart
															filters, and let AI
															handle the rest.
														</p>
														<table
															cellPadding={0}
															cellSpacing={0}
															role="presentation"
														>
															<tbody>
																<tr>
																	{[
																		"Smart filters",
																		"AI rules",
																		"Auto-archive",
																		"Zero clutter",
																	].map(
																		(
																			chip,
																		) => (
																			<td
																				key={
																					chip
																				}
																				style={{
																					fontSize:
																						"11px",
																					fontWeight: 600,
																					color: DARK,
																					backgroundColor:
																						"#f4f4f2",
																					border: "1px solid #e8e8e6",
																					borderRadius:
																						"100px",
																					padding:
																						"4px 12px",
																				}}
																			>
																				{
																					chip
																				}
																			</td>
																		),
																	)}
																</tr>
															</tbody>
														</table>
													</td>
												</tr>
											</tbody>
										</table>
									</td>
								</tr>
							</tbody>
						</table>

						{/* CTA section */}
						<table
							width="100%"
							cellPadding={0}
							cellSpacing={0}
							role="presentation"
						>
							<tbody>
								<tr>
									<td
										style={{
											padding: "32px 48px",
											borderBottom: "1px solid #f0f0ee",
										}}
									>
										<p
											style={{
												fontSize: "13.5px",
												lineHeight: 1.65,
												color: "#555",
												margin: "0 0 20px",
											}}
										>
											Get started by confirming your email
											address below. You can customize
											your communication preferences
											anytime from your account settings.
										</p>
										<Link
											href={url}
											style={{
												display: "inline-block",
												border: "1.5px solid #1a1a1a",
												color: DARK,
												textDecoration: "none",
												fontSize: "13px",
												fontWeight: 600,
												padding: "12px 28px",
												borderRadius: "8px",
											}}
										>
											Confirm my email address
										</Link>
									</td>
								</tr>
							</tbody>
						</table>

						{/* Footnote */}
						<table
							width="100%"
							cellPadding={0}
							cellSpacing={0}
							role="presentation"
							style={{ backgroundColor: "#fafaf8" }}
						>
							<tbody>
								<tr>
									<td style={{ padding: "24px 48px 28px" }}>
										<p
											style={{
												fontSize: "12px",
												color: "#aaa",
												lineHeight: 1.65,
												margin: "0 0 6px",
											}}
										>
											If you received this by mistake, you
											can safely ignore it — nothing will
											change.
										</p>
										<p
											style={{
												fontSize: "12px",
												color: "#aaa",
												lineHeight: 1.65,
												margin: 0,
											}}
										>
											Need help?{" "}
											<Link
												href="https://zer0email.com/contact"
												style={{
													color: "#888",
													textDecoration: "underline",
												}}
											>
												Contact our support team
											</Link>
											.
										</p>
									</td>
								</tr>
							</tbody>
						</table>
					</Section>

					{/* Footer */}
					<table
						width="100%"
						cellPadding={0}
						cellSpacing={0}
						role="presentation"
						style={{ backgroundColor: DARK }}
					>
						<tbody>
							<tr>
								<td style={{ padding: "28px 32px" }}>
									<table
										width="100%"
										cellPadding={0}
										cellSpacing={0}
										role="presentation"
										style={{
											borderBottom: "1px solid #333",
										}}
									>
										<tbody>
											<tr>
												<td
													style={{
														paddingBottom: "18px",
													}}
												>
													<Link
														href="https://zer0email.com/"
														style={{
															fontSize: "13px",
															fontWeight: 700,
															color: "#fff",
															textDecoration:
																"none",
														}}
													>
														Zer
														<span
															style={{
																color: "#666",
															}}
														>
															0
														</span>
														Email
													</Link>
												</td>
												<td
													align="right"
													style={{
														paddingBottom: "18px",
													}}
												>
													<Link
														href="https://zer0email.com/auth/signup"
														style={footerNavLink}
													>
														Log in
													</Link>
													<Link
														href="https://zer0email.com/pricing"
														style={footerNavLink}
													>
														Pricing
													</Link>
													<Link
														href="https://zer0email.com/contact"
														style={footerNavLink}
													>
														Contact
													</Link>
												</td>
											</tr>
										</tbody>
									</table>
									<table
										width="100%"
										cellPadding={0}
										cellSpacing={0}
										role="presentation"
										style={{ paddingTop: "20px" }}
									>
										<tbody>
											<tr>
												<td valign="bottom">
													<p style={footerMeta}>
														This email was sent from
														an unmonitored address.
													</p>
													<p style={footerMeta}>
														For support:{" "}
														<Link
															href="mailto:support@popsuites.ai"
															style={
																footerMetaLink
															}
														>
															support@popsuites.ai
														</Link>{" "}
														·{" "}
														<Link
															href="https://zer0email.com/legal/privacy-policy"
															style={
																footerMetaLink
															}
														>
															Unsubscribe
														</Link>
													</p>
													<p
														style={{
															...footerMeta,
															marginTop: "6px",
														}}
													>
														© 2026 PopPush AI. All
														rights reserved.
													</p>
													<p style={footerMeta}>
														<Link
															href="https://zer0email.com"
															style={
																footerMetaLink
															}
														>
															www.zer0email.com
														</Link>{" "}
														·{" "}
														<Link
															href="https://zer0email.com/privacy"
															style={
																footerMetaLink
															}
														>
															Privacy
														</Link>{" "}
														·{" "}
														<Link
															href="https://zer0email.com/terms"
															style={
																footerMetaLink
															}
														>
															Terms
														</Link>
													</p>
												</td>
												<td
													align="right"
													valign="bottom"
												>
													<Link
														href="https://x.com/Zer0Email"
														style={{
															color: "#666",
															textDecoration:
																"none",
															fontSize: "12px",
															fontWeight: 700,
														}}
													>
														𝕏
													</Link>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
				</Container>
			</Body>
		</Html>
	);
}

const footerNavLink: React.CSSProperties = {
	fontSize: "11px",
	fontWeight: 500,
	color: "#666",
	textDecoration: "none",
	textTransform: "uppercase",
	padding: "5px 10px",
	border: "1px solid #333",
	borderRadius: "4px",
	marginLeft: "4px",
};

const footerMeta: React.CSSProperties = {
	fontSize: "11px",
	color: "#555",
	lineHeight: 1.7,
	margin: 0,
};

const footerMetaLink: React.CSSProperties = {
	color: "#666",
	textDecoration: "underline",
};

Welcome.PreviewProps = {
	locale: defaultLocale,
	translations: defaultTranslations,
	url: "#",
	name: "John Doe",
};

export default Welcome;
