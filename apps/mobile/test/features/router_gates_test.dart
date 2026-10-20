import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mail_monkey/app.dart';
import 'package:mail_monkey/core/providers.dart';
import 'package:mail_monkey/core/security/token_store.dart';
import 'package:mail_monkey/features/auth/auth_controller.dart';
import 'package:mail_monkey/features/mail/mail_providers.dart';
import 'package:mail_monkey/features/onboarding/onboarding_screen.dart';
import 'package:mail_monkey/features/settings/force_password_change_screen.dart';
import 'package:mail_monkey/models/mailbox.dart';
import 'package:mail_monkey/models/session.dart';

class _FixedAuth extends AuthController {
  _FixedAuth(this._session);

  final AppSession? _session;

  @override
  Future<AppSession?> build() async => _session;
}

AppSession _session({bool onboarded = true, bool mustChange = false}) => AppSession(
  sessionId: 's1',
  user: AppUser(
    id: 'u1',
    name: 'Test User',
    email: 'test@example.com',
    onboardingComplete: onboarded,
    mustChangePassword: mustChange,
  ),
);

Future<void> _pump(WidgetTester tester, AppSession? session) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        tokenStoreProvider.overrideWithValue(MemoryTokenStore()),
        authControllerProvider.overrideWith(() => _FixedAuth(session)),
        mailboxesProvider.overrideWith((ref) async => const <Mailbox>[]),
      ],
      child: const MailMonkeyApp(),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 100));
}

void main() {
  testWidgets('signed out users land on sign-in', (tester) async {
    await _pump(tester, null);
    expect(find.text('Continue with Google'), findsOneWidget);
  });

  testWidgets('users who have not finished onboarding are sent there', (tester) async {
    await _pump(tester, _session(onboarded: false));
    expect(find.byType(OnboardingScreen), findsOneWidget);
    expect(find.text('What should we call you?'), findsOneWidget);
  });

  testWidgets('a system-generated password must be changed first', (tester) async {
    await _pump(tester, _session(mustChange: true));
    expect(find.byType(ForcePasswordChangeScreen), findsOneWidget);
    expect(find.widgetWithText(AppBar, 'Change your password'), findsOneWidget);
  });
}
