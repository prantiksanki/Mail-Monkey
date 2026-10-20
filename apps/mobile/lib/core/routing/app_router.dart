import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/admin/admin_screen.dart';
import '../../features/ai/assistant_chat_screen.dart';
import '../../features/ai/assistant_screen.dart';
import '../../features/ai/rules_assistant_screen.dart';
import '../../features/ai/voice_compose_screen.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/auth/sign_in_screen.dart';
import '../../features/auth/splash_screen.dart';
import '../../features/bills/bill_detail_screen.dart';
import '../../features/bills/bills_screen.dart';
import '../../features/creator/bookings_screen.dart';
import '../../features/creator/my_page_screen.dart';
import '../../features/insights/activity_screen.dart';
import '../../features/insights/analytics_screen.dart';
import '../../features/insights/calendar_screen.dart';
import '../../features/insights/dashboard_screen.dart';
import '../../features/insights/notifications_screen.dart';
import '../../features/mail/compose/compose_screen.dart';
import '../../features/mail/inbox/inbox_screen.dart';
import '../../features/mail/lists/drafts_screen.dart';
import '../../features/mail/lists/scheduled_screen.dart';
import '../../features/mail/lists/snoozed_screen.dart';
import '../../features/mail/mail_providers.dart';
import '../../features/mail/message/message_screen.dart';
import '../../features/onboarding/onboarding_screen.dart';
import '../../features/rules/rule_editor_screen.dart';
import '../../features/rules/rules_screen.dart';
import '../../features/settings/billing_settings_screen.dart';
import '../../features/settings/connect_imap_screen.dart';
import '../../features/settings/danger_zone_screen.dart';
import '../../features/settings/force_password_change_screen.dart';
import '../../features/settings/general_settings_screen.dart';
import '../../features/settings/integrations_settings_screen.dart';
import '../../features/settings/mailboxes_settings_screen.dart';
import '../../features/settings/security_settings_screen.dart';
import '../../features/settings/settings_screen.dart';
import 'routes.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  // Re-evaluate redirects whenever the auth state changes.
  final authChanges = ValueNotifier<AsyncValue<Object?>>(const AsyncLoading());
  ref.listen(
    authControllerProvider,
    (_, next) => authChanges.value = next,
    fireImmediately: true,
  );
  ref.onDispose(authChanges.dispose);

  return GoRouter(
    initialLocation: Routes.splash,
    refreshListenable: authChanges,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final location = state.matchedLocation;
      final onPublic = location == Routes.splash || location == Routes.signIn;

      if (auth.isLoading && !auth.hasValue) {
        return location == Routes.splash ? null : Routes.splash;
      }
      final user = auth.value?.user;
      if (user == null) return location == Routes.signIn ? null : Routes.signIn;
      // Same gates as apps/web/app/(saas)/app/layout.tsx: onboarding first,
      // then a forced change of a system-generated password. Connecting a
      // custom mailbox stays reachable from onboarding.
      if (!user.onboardingComplete) {
        return location == Routes.onboarding || location == Routes.connectMailbox ? null : Routes.onboarding;
      }
      if (user.mustChangePassword) {
        return location == Routes.forcePasswordChange ? null : Routes.forcePasswordChange;
      }
      if (onPublic || location == Routes.onboarding || location == Routes.forcePasswordChange) {
        return Routes.inbox;
      }
      return null;
    },
    routes: [
      GoRoute(path: Routes.splash, builder: (_, _) => const SplashScreen()),
      GoRoute(path: Routes.signIn, builder: (_, _) => const SignInScreen()),
      GoRoute(
        path: Routes.inbox,
        builder: (_, state) => InboxScreen(
          folder: state.uri.queryParameters['folder'] ?? 'inbox',
          label: state.uri.queryParameters['label'],
        ),
      ),
      GoRoute(
        path: Routes.message,
        builder: (_, state) => MessageScreen(
          messageId: state.pathParameters['id']!,
          query: state.extra is InboxQuery ? state.extra! as InboxQuery : null,
        ),
      ),
      GoRoute(
        path: Routes.compose,
        builder: (_, state) => ComposeScreen(
          args: state.extra is ComposeArgs
              ? state.extra! as ComposeArgs
              : const ComposeArgs(),
        ),
      ),
      GoRoute(path: Routes.drafts, builder: (_, _) => const DraftsScreen()),
      GoRoute(path: Routes.scheduled, builder: (_, _) => const ScheduledScreen()),
      GoRoute(path: Routes.snoozed, builder: (_, _) => const SnoozedScreen()),
      GoRoute(path: Routes.dashboard, builder: (_, _) => const DashboardScreen()),
      GoRoute(path: Routes.analytics, builder: (_, _) => const AnalyticsScreen()),
      GoRoute(path: Routes.activity, builder: (_, _) => const ActivityScreen()),
      GoRoute(path: Routes.notifications, builder: (_, _) => const NotificationsScreen()),
      GoRoute(path: Routes.calendar, builder: (_, _) => const CalendarScreen()),
      GoRoute(path: Routes.rules, builder: (_, _) => const RulesScreen()),
      GoRoute(path: Routes.ruleEdit, builder: (_, state) => RuleEditorScreen(initial: state.extra)),
      GoRoute(path: Routes.rulesAssistant, builder: (_, _) => const RulesAssistantScreen()),
      GoRoute(path: Routes.aiAssistant, builder: (_, _) => const AssistantScreen()),
      GoRoute(
        path: Routes.aiChat,
        builder: (_, state) => AssistantChatScreen(
          conversationId: state.pathParameters['id']!,
          isNew: state.uri.queryParameters['new'] == '1',
          initialText: state.extra is String ? state.extra! as String : null,
        ),
      ),
      GoRoute(path: Routes.voiceCompose, builder: (_, _) => const VoiceComposeScreen()),
      GoRoute(path: Routes.onboarding, builder: (_, _) => const OnboardingScreen()),
      GoRoute(path: Routes.forcePasswordChange, builder: (_, _) => const ForcePasswordChangeScreen()),
      GoRoute(path: Routes.bills, builder: (_, _) => const BillsScreen()),
      GoRoute(path: Routes.bill, builder: (_, state) => BillDetailScreen(id: state.pathParameters['id']!)),
      GoRoute(path: Routes.myPage, builder: (_, _) => const MyPageScreen()),
      GoRoute(path: Routes.bookings, builder: (_, _) => const BookingsScreen()),
      GoRoute(path: Routes.settings, builder: (_, _) => const SettingsScreen()),
      GoRoute(path: Routes.settingsGeneral, builder: (_, _) => const GeneralSettingsScreen()),
      GoRoute(path: Routes.settingsSecurity, builder: (_, _) => const SecuritySettingsScreen()),
      GoRoute(path: Routes.settingsMailboxes, builder: (_, _) => const MailboxesSettingsScreen()),
      GoRoute(path: Routes.connectMailbox, builder: (_, _) => const ConnectImapScreen()),
      GoRoute(path: Routes.settingsIntegrations, builder: (_, _) => const IntegrationsSettingsScreen()),
      GoRoute(path: Routes.settingsBilling, builder: (_, _) => const BillingSettingsScreen()),
      GoRoute(path: Routes.settingsDanger, builder: (_, _) => const DangerZoneScreen()),
      GoRoute(path: Routes.adminUsers, builder: (_, _) => const AdminScreen()),
      GoRoute(path: Routes.adminOrganizations, builder: (_, _) => const AdminScreen(initialTab: 1)),
    ],
    errorBuilder: (context, state) => Scaffold(
      appBar: AppBar(),
      body: const Center(child: Text('Page not found')),
    ),
  );
});
