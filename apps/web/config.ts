export const config = {
	// the name of the app
	appName: "Mail Monkey",

	// the link to the documentation app (if not defined, the documentation link will not be shown in the app)
	docsLink: process.env.NEXT_PUBLIC_DOCS_URL as string | undefined,

	// the themes that should be available in the app
	enabledThemes: ["light", "dark"],
	// the default theme
	defaultTheme: "light",

	// the saas part of the application
	saas: {
		// whether the saas part should be enabled (otherwise all routes will be redirect to the marketing page)
		enabled: true,

		// whether the sidebar layout should be used
		useSidebarLayout: true,

		// the redirect path after sign in
		redirectAfterSignIn: "/app",

		// the redirect path after logout
		redirectAfterLogout: "/auth/login",
	},

	// the marketing part of the application
	marketing: {
		// whether the marketing features should be enabled (otherwise all routes will be redirect to the saas part)
		enabled: true,
	},

	// app sections that can be hidden from the UI (e.g. for a demo). Only the
	// menu entries / page sections are hidden; routes and logic keep working.
	ui: {
		// Settings → Integrations menu entry
		showIntegrations: false,
		// Settings → General: Creator & Freelancer mode, Media Kit, Profile Analytics
		showCreatorMode: false,
		// Sidebar → Bills entry and the dashboard payment alert
		showBills: true,
		// Home page stats band (hours saved, $ saved, emails processed)
		showStats: false,
	},
} as const;
