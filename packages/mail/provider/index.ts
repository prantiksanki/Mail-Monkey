// Active transactional email provider. Swap this line to change senders;
// each adapter exports a `send: SendEmailHandler`.
// Previous: "./resend" (kept in the tree as a rollback path).
export * from "./ses";
