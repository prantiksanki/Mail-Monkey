import { LocaleLink } from "@i18n/routing";
import { slugifyHeadline } from "@shared/lib/content";
import type { MDXComponents } from "mdx/types";
import type { ImageProps } from "next/image";
import Image from "next/image";

export const mdxComponents = {
	a: (props) => {
		const { href, children, ref: _ref, ...rest } = props;
		const isInternalLink =
			href && (href.startsWith("/") || href.startsWith("#"));

		return isInternalLink ? (
			<LocaleLink
				href={href}
				className="font-medium underline underline-offset-4 decoration-primary/40 hover:decoration-primary transition-colors"
				{...rest}
			>
				{children}
			</LocaleLink>
		) : (
			<a
				target="_blank"
				rel="noopener noreferrer"
				href={href}
				className="font-medium underline underline-offset-4 decoration-primary/40 hover:decoration-primary transition-colors"
				{...rest}
			>
				{children}
			</a>
		);
	},
	img: (props) =>
		props.src ? (
			<span className="block my-8">
				<Image
					{...(props as ImageProps)}
					sizes="100vw"
					style={{ width: "100%", height: "auto" }}
					className="rounded-2xl shadow-sm"
					loading="lazy"
				/>
			</span>
		) : null,
	h1: ({ children, ...rest }) => (
		<h1
			id={slugifyHeadline(children as string)}
			className="mt-12 mb-4 font-bold text-3xl md:text-4xl leading-tight tracking-tight text-foreground"
			{...rest}
		>
			{children}
		</h1>
	),
	h2: ({ children, ...rest }) => (
		<h2
			id={slugifyHeadline(children as string)}
			className="mt-10 mb-4 font-bold text-2xl md:text-3xl leading-tight tracking-tight text-foreground"
			{...rest}
		>
			{children}
		</h2>
	),
	h3: ({ children, ...rest }) => (
		<h3
			id={slugifyHeadline(children as string)}
			className="mt-8 mb-3 font-semibold text-xl leading-snug text-foreground"
			{...rest}
		>
			{children}
		</h3>
	),
	h4: ({ children, ...rest }) => (
		<h4
			id={slugifyHeadline(children as string)}
			className="mt-6 mb-2 font-semibold text-lg leading-snug text-foreground"
			{...rest}
		>
			{children}
		</h4>
	),
	h5: ({ children, ...rest }) => (
		<h5
			id={slugifyHeadline(children as string)}
			className="mt-6 mb-2 font-semibold text-base text-foreground"
			{...rest}
		>
			{children}
		</h5>
	),
	h6: ({ children, ...rest }) => (
		<h6
			id={slugifyHeadline(children as string)}
			className="mt-4 mb-2 font-semibold text-sm uppercase tracking-wider text-muted-foreground"
			{...rest}
		>
			{children}
		</h6>
	),
	p: ({ children, ...rest }) => (
		<p
			className="mb-6 text-[17px] leading-[1.85] text-foreground/85"
			{...rest}
		>
			{children}
		</p>
	),
	ul: ({ children, ...rest }) => (
		<ul
			className="mb-6 space-y-2 pl-5 text-[17px] leading-[1.85] text-foreground/85 [&>li]:list-disc [&>li]:marker:text-primary/40"
			{...rest}
		>
			{children}
		</ul>
	),
	ol: ({ children, ...rest }) => (
		<ol
			className="mb-6 space-y-2 pl-5 text-[17px] leading-[1.85] text-foreground/85 [&>li]:list-decimal [&>li]:marker:text-primary/40"
			{...rest}
		>
			{children}
		</ol>
	),
	li: ({ children, ...rest }) => (
		<li className="pl-1" {...rest}>
			{children}
		</li>
	),
	blockquote: ({ children, ...rest }) => (
		<blockquote
			className="my-8 border-l-4 border-primary/20 pl-6 italic text-muted-foreground text-[17px] leading-[1.85]"
			{...rest}
		>
			{children}
		</blockquote>
	),
	hr: () => <hr className="my-10 border-0 border-t border-border" />,
	code: ({ children, ...rest }) => (
		<code
			className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.88em] text-foreground"
			{...rest}
		>
			{children}
		</code>
	),
	pre: ({ children, ...rest }) => (
		<pre
			className="my-6 overflow-x-auto rounded-2xl bg-[#1e1e2e] p-5 text-sm leading-relaxed"
			{...rest}
		>
			{children}
		</pre>
	),
	strong: ({ children, ...rest }) => (
		<strong className="font-semibold text-foreground" {...rest}>
			{children}
		</strong>
	),
	em: ({ children, ...rest }) => (
		<em className="italic" {...rest}>
			{children}
		</em>
	),
} satisfies MDXComponents;
