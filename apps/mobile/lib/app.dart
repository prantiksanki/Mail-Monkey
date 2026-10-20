import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/routing/app_router.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/auth_controller.dart';
import 'features/mail/mail_providers.dart';
import 'features/settings/settings_providers.dart';

final _messengerKey = GlobalKey<ScaffoldMessengerState>();

class MailMonkeyApp extends ConsumerWidget {
  const MailMonkeyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Once per sign-in, finish a custom-email connection started before
    // sign-up (web PendingImapMailboxConnector).
    ref.listen(authControllerProvider, (previous, next) {
      final wasSignedIn = previous?.value != null;
      if (!wasSignedIn && next.value != null) unawaited(_finishPendingImap(ref));
    });

    return MaterialApp.router(
      title: 'Mail Monkey',
      debugShowCheckedModeBanner: false,
      scaffoldMessengerKey: _messengerKey,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      routerConfig: ref.watch(appRouterProvider),
    );
  }

  static Future<void> _finishPendingImap(WidgetRef ref) async {
    try {
      final email = await ref.read(integrationsServiceProvider).finishPendingImap();
      if (email == null) return;
      ref.invalidate(mailboxesProvider);
      _messengerKey.currentState?.showSnackBar(SnackBar(content: Text('$email has been connected')));
    } on Exception {
      // Nothing pending, or it failed; the user can connect from Settings.
    }
  }
}
