import { Text } from "@react-email/components";
import React from "react";
import Wrapper from "../components/Wrapper";

export function TelegramOtp({
	code,
	expiresInMinutes,
}: {
	code: string;
	expiresInMinutes: number;
}) {
	return (
		<Wrapper>
			<Text className="text-foreground">
				Your Mail Monkey Telegram login code is:
			</Text>

			<Text className="text-center font-mono text-4xl font-bold tracking-widest text-primary">
				{code}
			</Text>

			<Text className="text-muted-foreground text-sm">
				This code expires in {expiresInMinutes} minutes. Do not share it
				with anyone.
			</Text>

			<Text className="text-muted-foreground text-sm">
				If you did not request this code, you can ignore this email.
			</Text>
		</Wrapper>
	);
}

TelegramOtp.PreviewProps = {
	code: "482931",
	expiresInMinutes: 10,
};

export default TelegramOtp;
