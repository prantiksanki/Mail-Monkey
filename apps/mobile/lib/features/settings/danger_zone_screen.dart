import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/widgets/state_views.dart';
import 'settings_providers.dart';
import 'settings_widgets.dart';

/// Settings → Danger zone (web DeleteAccountForm). The server emails a
/// confirmation link; the account is only deleted once it's opened.
class DangerZoneScreen extends ConsumerWidget {
  const DangerZoneScreen({super.key});

  Future<void> _delete(BuildContext context, WidgetRef ref) async {
    final ok = await confirmAction(
      context,
      title: 'Delete account',
      message:
          'Are you sure you want to delete your account? Your mailboxes, rules and data will be removed. '
          "We'll email you a link to confirm.",
      confirmLabel: 'Delete account',
    );
    if (!ok) return;
    try {
      await ref.read(accountServiceProvider).deleteUser();
      if (context.mounted) showMessage(context, 'Check your email to confirm deleting your account.');
    } on Exception {
      if (context.mounted) showMessage(context, 'Could not delete account', error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: const Text('Danger zone')),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        SettingsSection(
          title: 'Delete account',
          description: 'Permanently delete your account and everything connected to it. This cannot be undone.',
          danger: true,
          child: Align(
            alignment: Alignment.centerLeft,
            child: FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
              onPressed: () => _delete(context, ref),
              child: const Text('Delete account'),
            ),
          ),
        ),
      ],
    ),
  );
}
