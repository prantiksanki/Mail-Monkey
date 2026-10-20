import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/account.dart';
import '../../shared/widgets/state_views.dart';
import '../auth/auth_controller.dart';
import 'change_password_form.dart';
import 'settings_providers.dart';
import 'settings_widgets.dart';

const _socialProviders = {'google': 'Google', 'microsoft': 'Microsoft'};

/// Settings → Security (web: ChangePasswordForm, ConnectedAccountsBlock,
/// TwoFactorBlock, ActiveSessionsBlock). Password and 2FA only apply to
/// accounts that have a password, as on the web.
class SecuritySettingsScreen extends ConsumerWidget {
  const SecuritySettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final accounts = ref.watch(linkedAccountsProvider);
    final hasPassword = accounts.value?.any((a) => a.providerId == 'credential') ?? false;
    return Scaffold(
      appBar: AppBar(title: const Text('Security')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (hasPassword)
            const SettingsSection(title: 'Password', child: ChangePasswordForm()),
          SettingsSection(
            title: 'Connected accounts',
            description: 'Sign-in methods linked to your account.',
            child: accounts.when(
              loading: () => const LinearProgressIndicator(),
              error: (e, _) => Text(errorMessage(e)),
              data: (list) => Column(
                children: [
                  for (final e in _socialProviders.entries)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(e.key == 'google' ? Icons.g_mobiledata : Icons.window),
                      title: Text(e.value),
                      trailing: list.any((a) => a.providerId == e.key)
                          ? const Chip(label: Text('Connected'))
                          : const Text('Not connected'),
                    ),
                  const BlockedNotice(
                    'Linking another sign-in method needs a browser session and is only available on the web.',
                  ),
                ],
              ),
            ),
          ),
          if (hasPassword) const _TwoFactorSection(),
          const _SessionsSection(),
        ],
      ),
    );
  }
}

class _TwoFactorSection extends ConsumerWidget {
  const _TwoFactorSection();

  Future<String?> _askPassword(BuildContext context, String title) {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          obscureText: true,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Password'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, controller.text), child: const Text('Continue')),
        ],
      ),
    ).whenComplete(controller.dispose);
  }

  Future<void> _enable(BuildContext context, WidgetRef ref) async {
    final password = await _askPassword(context, 'Verify with your password');
    if (password == null || password.isEmpty || !context.mounted) return;
    final account = ref.read(accountServiceProvider);
    final String uri;
    try {
      uri = await account.enableTwoFactor(password);
    } on Exception {
      if (context.mounted) showMessage(context, 'Could not enable two-factor authentication', error: true);
      return;
    }
    if (!context.mounted) return;
    final secret = Uri.tryParse(uri)?.queryParameters['secret'];
    final code = TextEditingController();
    final verified = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Set up your authenticator'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Add this key to your authenticator app, then enter the 6-digit code it shows.'),
              const SizedBox(height: 12),
              SelectableText(secret ?? uri, style: const TextStyle(fontFamily: 'monospace')),
              TextButton.icon(
                onPressed: () => Clipboard.setData(ClipboardData(text: secret ?? uri)),
                icon: const Icon(Icons.copy),
                label: const Text('Copy key'),
              ),
              TextField(
                controller: code,
                keyboardType: TextInputType.number,
                maxLength: 6,
                decoration: const InputDecoration(labelText: 'Code'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              try {
                await account.verifyTotp(code.text.trim());
                if (context.mounted) Navigator.pop(context, true);
              } on Exception {
                if (context.mounted) showMessage(context, 'That code is not valid', error: true);
              }
            },
            child: const Text('Verify'),
          ),
        ],
      ),
    );
    code.dispose();
    if (verified ?? false) {
      await ref.read(authControllerProvider.notifier).refresh();
      if (context.mounted) showMessage(context, 'Two-factor authentication enabled');
    }
  }

  Future<void> _disable(BuildContext context, WidgetRef ref) async {
    final password = await _askPassword(context, 'Disable two-factor authentication');
    if (password == null || password.isEmpty) return;
    try {
      await ref.read(accountServiceProvider).disableTwoFactor(password);
      await ref.read(authControllerProvider.notifier).refresh();
      if (context.mounted) showMessage(context, 'Two-factor authentication disabled');
    } on Exception {
      if (context.mounted) showMessage(context, 'Could not disable two-factor authentication', error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final enabled = ref.watch(authControllerProvider).value?.user.twoFactorEnabled ?? false;
    return SettingsSection(
      title: 'Two-factor authentication',
      description: 'Require a code from an authenticator app when signing in with your password.',
      child: Row(
        children: [
          Icon(enabled ? Icons.verified_user : Icons.shield_outlined, color: enabled ? Colors.green : null),
          const SizedBox(width: 8),
          Expanded(child: Text(enabled ? 'Enabled' : 'Not enabled')),
          FilledButton.tonal(
            onPressed: () => enabled ? _disable(context, ref) : _enable(context, ref),
            child: Text(enabled ? 'Disable' : 'Enable'),
          ),
        ],
      ),
    );
  }
}

class _SessionsSection extends ConsumerWidget {
  const _SessionsSection();

  Future<void> _revoke(BuildContext context, WidgetRef ref, ActiveSession s, {required bool current}) async {
    if (current) {
      final ok = await confirmAction(
        context,
        title: 'Sign out this device?',
        message: 'This is the session you are using now.',
        confirmLabel: 'Sign out',
      );
      if (!ok) return;
    }
    try {
      await ref.read(accountServiceProvider).revokeSession(s.token);
      if (current) {
        await ref.read(authControllerProvider.notifier).signOut();
        return;
      }
      ref.invalidate(sessionsProvider);
      if (context.mounted) showMessage(context, 'Session revoked');
    } on Exception catch (e) {
      if (context.mounted) showMessage(context, errorMessage(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentId = ref.watch(authControllerProvider).value?.sessionId;
    return SettingsSection(
      title: 'Active sessions',
      description: 'Devices and browsers signed in to your account.',
      child: ref.watch(sessionsProvider).when(
        loading: () => const LinearProgressIndicator(),
        error: (e, _) => Text(errorMessage(e)),
        data: (sessions) => Column(
          children: [
            for (final s in sessions)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(_isMobile(s.userAgent) ? Icons.smartphone : Icons.computer),
                title: Text(s.id == currentId ? 'This device' : (s.ipAddress ?? 'Unknown location')),
                subtitle: Text(s.userAgent ?? '', maxLines: 2, overflow: TextOverflow.ellipsis),
                trailing: IconButton(
                  tooltip: 'Revoke',
                  icon: const Icon(Icons.logout),
                  onPressed: () => _revoke(context, ref, s, current: s.id == currentId),
                ),
              ),
          ],
        ),
      ),
    );
  }

  static bool _isMobile(String? ua) =>
      ua != null && RegExp('android|iphone|ipad|dart', caseSensitive: false).hasMatch(ua);
}
