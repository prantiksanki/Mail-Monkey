import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/routes.dart';
import '../../shared/widgets/brand_logo.dart';
import '../../shared/widgets/state_views.dart';
import '../auth/auth_controller.dart';
import '../mail/mail_providers.dart';
import '../settings/settings_providers.dart';
import '../settings/settings_widgets.dart';

/// First-run onboarding (web OnboardingForm). As on the web, it completes
/// itself as soon as the account has a mailbox; otherwise the user sets a
/// name and connects a custom email first.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  late final _name = TextEditingController(text: ref.read(authControllerProvider).value?.user.name ?? '');
  int _step = 0;
  bool _completing = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _complete() async {
    if (_completing) return;
    _completing = true;
    try {
      await ref.read(accountServiceProvider).updateUser({'onboardingComplete': true});
      await ref.read(authControllerProvider.notifier).refresh();
    } on Exception catch (e) {
      _completing = false;
      if (mounted) showMessage(context, errorMessage(e), error: true);
    }
  }

  Future<void> _saveName() async {
    final name = _name.text.trim();
    if (name.length < 3) {
      showMessage(context, 'Name must be at least 3 characters', error: true);
      return;
    }
    try {
      await ref.read(accountServiceProvider).updateUser({'name': name});
      setState(() => _step = 1);
    } on Exception catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mailboxes = ref.watch(mailboxesProvider);
    if (mailboxes.value?.isNotEmpty ?? false) {
      WidgetsBinding.instance.addPostFrameCallback((_) => unawaited(_complete()));
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const BrandLogo(height: 32),
        actions: [
          TextButton(
            onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
            child: const Text('Sign out'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text('Step ${_step + 1} of 2', style: theme.textTheme.labelMedium),
          const SizedBox(height: 8),
          if (_step == 0) ...[
            Text('What should we call you?', style: theme.textTheme.headlineSmall),
            const SizedBox(height: 16),
            TextField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Your name'),
            ),
            const SizedBox(height: 16),
            BusyButton(label: 'Continue', onPressed: _saveName),
          ] else ...[
            Text('Connect your inbox', style: theme.textTheme.headlineSmall),
            const SizedBox(height: 8),
            const Text('Mail Monkey needs a mailbox to sort, label and draft for you.'),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () async {
                await context.push(Routes.connectMailbox);
                ref.invalidate(mailboxesProvider);
              },
              icon: const Icon(Icons.dns_outlined),
              label: const Text('Connect a custom email (IMAP)'),
            ),
            const SizedBox(height: 12),
            const BlockedNotice(
              'To use Gmail or Outlook, sign out and sign in with that account — its mailbox is connected automatically.',
            ),
            const SizedBox(height: 12),
            TextButton(onPressed: () => ref.invalidate(mailboxesProvider), child: const Text('I connected one — refresh')),
          ],
        ],
      ),
    );
  }
}
