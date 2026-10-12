import { DeleteAccountVerification } from "../emails/DeleteAccountVerification";
import { EmailVerification } from "../emails/EmailVerification";
import { ForgotPassword } from "../emails/ForgotPassword";
import { MagicLink } from "../emails/MagicLink";
import { NewsletterSignup } from "../emails/NewsletterSignup";
import { NewUser } from "../emails/NewUser";
import { OrganizationInvitation } from "../emails/OrganizationInvitation";
import { TelegramOtp } from "../emails/TelegramOtp";
import { Welcome } from "../emails/Welcome";

export const mailTemplates = {
	magicLink: MagicLink,
	forgotPassword: ForgotPassword,
	deleteAccountVerification: DeleteAccountVerification,
	newUser: NewUser,
	newsletterSignup: NewsletterSignup,
	organizationInvitation: OrganizationInvitation,
	emailVerification: EmailVerification,
	welcome: Welcome,
	telegramOtp: TelegramOtp,
} as const;
