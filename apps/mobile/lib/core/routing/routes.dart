/// Route paths, mirroring the web app's sections.
abstract final class Routes {
  static const splash = '/splash';
  static const signIn = '/sign-in';
  static const onboarding = '/onboarding';
  static const forcePasswordChange = '/force-password-change';

  // Mail
  static const inbox = '/';
  static const message = '/message/:id';
  static const compose = '/compose';
  static const drafts = '/drafts';
  static const scheduled = '/scheduled';
  static const snoozed = '/snoozed';

  // Insights
  static const dashboard = '/dashboard';
  static const analytics = '/analytics';
  static const activity = '/activity';
  static const notifications = '/notifications';
  static const calendar = '/calendar';

  // Automation & AI
  static const rules = '/rules';
  static const ruleEdit = '/rules/edit';
  static const rulesAssistant = '/rules/assistant';
  static const aiAssistant = '/ai';
  static const aiChat = '/ai/chat/:id';
  static const voiceCompose = '/voice';

  // Bills (payment tracking)
  static const bills = '/bills';
  static const bill = '/bills/:id';

  // Creator mode
  static const myPage = '/my-page';
  static const bookings = '/bookings';

  // Settings
  static const settings = '/settings';
  static const settingsGeneral = '/settings/general';
  static const settingsSecurity = '/settings/security';
  static const settingsMailboxes = '/settings/mailboxes';
  static const settingsIntegrations = '/settings/integrations';
  static const settingsBilling = '/settings/billing';
  static const settingsDanger = '/settings/danger-zone';
  static const connectMailbox = '/settings/mailboxes/connect';

  // Admin
  static const adminUsers = '/admin/users';
  static const adminOrganizations = '/admin/organizations';

  static String messagePath(String id) => '/message/${Uri.encodeComponent(id)}';
  static String aiChatPath(String id, {bool isNew = false}) =>
      '/ai/chat/${Uri.encodeComponent(id)}${isNew ? '?new=1' : ''}';
  static String billPath(String id) => '/bills/${Uri.encodeComponent(id)}';

  static String inboxPath({String folder = 'inbox', String? label}) {
    final params = <String, String>{
      if (folder != 'inbox') 'folder': folder,
      'label': ?label,
    };
    return Uri(path: inbox, queryParameters: params.isEmpty ? null : params).toString();
  }
}
