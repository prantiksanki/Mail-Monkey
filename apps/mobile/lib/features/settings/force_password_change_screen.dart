import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import 'change_password_form.dart';

/// Shown while `mustChangePassword` is set (system-generated initial
/// password, CASA 1.1.2) — same gate as the web's /force-password-change.
/// The server clears the flag after a successful change.
class ForcePasswordChangeScreen extends ConsumerWidget {
  const ForcePasswordChangeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(
      title: const Text('Change your password'),
      automaticallyImplyLeading: false,
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
        const Text('Your account was created with a temporary password. Choose a new one to continue.'),
        const SizedBox(height: 24),
        ChangePasswordForm(onChanged: () => ref.read(authControllerProvider.notifier).refresh()),
      ],
    ),
  );
}
