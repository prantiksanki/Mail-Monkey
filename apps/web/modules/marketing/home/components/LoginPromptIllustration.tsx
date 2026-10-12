import Image from "next/image";

interface LoginPromptIllustrationProps {
	className?: string;
}

export function LoginPromptIllustration({
	className,
}: LoginPromptIllustrationProps) {
	return (
		<Image
			src="/images/login.svg"
			alt="Sign up illustration"
			width={512}
			height={512}
			unoptimized
			className={className}
		/>
	);
}
