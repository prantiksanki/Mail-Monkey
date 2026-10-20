import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/routes.dart';
import '../../shared/widgets/app_drawer.dart';
import '../auth/auth_controller.dart';

/// Settings menu (web SettingsMenu).
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).value?.user;
    Widget entry(IconData icon, String title, String subtitle, String route) => ListTile(
      leading: Icon(icon),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => context.push(route),
    );

    return Scaffold(
      drawer: const AppDrawer(selected: 'settings'),
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          entry(Icons.person_outline, 'General', 'Photo, name, email, creator mode', Routes.settingsGeneral),
          entry(Icons.alternate_email, 'Mailboxes', 'Connected accounts, sync and diagnostics', Routes.settingsMailboxes),
          entry(Icons.extension_outlined, 'Integrations', 'Telegram, Zoom, Zoho Meeting', Routes.settingsIntegrations),
          entry(Icons.credit_card, 'Billing', 'Plan and payments', Routes.settingsBilling),
          entry(Icons.lock_outline, 'Security', 'Sign-in methods, two-factor, sessions', Routes.settingsSecurity),
          if (user?.isCreator ?? false) ...[
            entry(Icons.person_pin_outlined, 'My Page', 'Public profile, links, booking, design', Routes.myPage),
          ],
          entry(Icons.warning_amber_outlined, 'Danger zone', 'Delete your account', Routes.settingsDanger),
          if (user?.isAdmin ?? false)
            entry(Icons.admin_panel_settings_outlined, 'Admin', 'Users and organizations', Routes.adminUsers),
        ],
      ),
    );
  }
}
