import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config/env.dart';
import '../../core/routing/routes.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/mail/mail_providers.dart';
import '../../models/label.dart';
import '../../models/mailbox.dart';
import 'brand_logo.dart';
import 'state_views.dart';

/// Main navigation — mirrors the web sidebar (Mail folders, labels, and the
/// app's other sections).
class AppDrawer extends ConsumerWidget {
  const AppDrawer({super.key, this.selected});

  /// Current location key, e.g. `folder:inbox`, `label:Receipts`, `drafts`.
  final String? selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mailbox = ref.watch(selectedMailboxProvider);
    final counts = mailbox == null
        ? null
        : ref.watch(labelCountsProvider(mailbox.id)).value;
    final labels = mailbox == null
        ? const <MailLabel>[]
        : ref.watch(labelsProvider(mailbox.id));
    final user = ref.watch(authControllerProvider).value?.user;
    final theme = Theme.of(context);

    void go(String location) {
      Navigator.of(context).pop();
      context.go(location);
    }

    Widget item(
      String key,
      IconData icon,
      String label,
      String location, {
      int count = 0,
    }) => NavigationDrawerDestinationTile(
      icon: icon,
      label: label,
      selected: selected == key,
      count: count,
      onTap: () => go(location),
    );

    // The drawer is only built while open. Claiming Back here makes Android
    // close the drawer instead of leaving the app from a top-level screen.
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Scaffold.maybeOf(context)?.closeDrawer();
      },
      child: NavigationDrawer(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
            child: const Align(
              alignment: Alignment.centerLeft,
              child: BrandLogo(height: 44),
            ),
          ),
          const _MailboxSwitcher(),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: FilledButton.icon(
              onPressed: mailbox == null
                  ? null
                  : () {
                      Navigator.of(context).pop();
                      context.push(Routes.compose);
                    },
              icon: const Icon(Icons.edit_outlined),
              label: const Text('Compose'),
            ),
          ),
          item(
            'folder:inbox',
            Icons.inbox_outlined,
            'Inbox',
            Routes.inboxPath(),
            count: counts?.inboxUnreadCount ?? 0,
          ),
          item(
            'folder:all',
            Icons.all_inbox_outlined,
            'All Emails',
            Routes.inboxPath(folder: 'all'),
          ),
          item(
            'folder:sent',
            Icons.send_outlined,
            'Sent',
            Routes.inboxPath(folder: 'sent'),
          ),
          item('drafts', Icons.drafts_outlined, 'Drafts', Routes.drafts),
          item(
            'folder:trash',
            Icons.delete_outline,
            'Trash',
            Routes.inboxPath(folder: 'trash'),
          ),
          item(
            'scheduled',
            Icons.schedule_send_outlined,
            'Scheduled',
            Routes.scheduled,
          ),
          item('snoozed', Icons.snooze_outlined, 'Snoozed', Routes.snoozed),
          if (labels.isNotEmpty) ...[
            const Divider(indent: 16, endIndent: 16),
            Padding(
              padding: const EdgeInsets.fromLTRB(28, 8, 16, 4),
              child: Text(
                'LABELS',
                style: theme.textTheme.labelSmall?.copyWith(
                  letterSpacing: 1.2,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
            for (final label in labels)
              NavigationDrawerDestinationTile(
                icon: Icons.circle,
                iconColor: label.color.background,
                iconSize: 12,
                label: label.name,
                selected: selected == 'label:${label.name}',
                count: counts?.countFor(label.name) ?? 0,
                onTap: () =>
                    go(Routes.inboxPath(folder: 'all', label: label.name)),
              ),
          ],
          const Divider(indent: 16, endIndent: 16),
          item(
            'dashboard',
            Icons.dashboard_outlined,
            'Dashboard',
            Routes.dashboard,
          ),
          item(
            'calendar',
            Icons.calendar_month_outlined,
            'Calendar',
            Routes.calendar,
          ),
          item('bills', Icons.receipt_long_outlined, 'Payments', Routes.bills),
          item('rules', Icons.rule, 'Rules', Routes.rules),
          item('activity', Icons.history, 'Activity', Routes.activity),
          item(
            'ai',
            Icons.auto_awesome_outlined,
            'AI assistant',
            Routes.aiAssistant,
          ),
          item(
            'analytics',
            Icons.insights_outlined,
            'Analytics',
            Routes.analytics,
          ),
          item(
            'notifications',
            Icons.notifications_outlined,
            'Notifications',
            Routes.notifications,
          ),
          if (user?.isCreator ?? false) ...[
            item(
              'my-page',
              Icons.person_pin_outlined,
              'My Page',
              Routes.myPage,
            ),
            item(
              'bookings',
              Icons.event_available_outlined,
              'Bookings',
              Routes.bookings,
            ),
          ],
          item(
            'settings',
            Icons.settings_outlined,
            'Settings',
            Routes.settings,
          ),
          if (user?.isAdmin ?? false)
            item(
              'admin',
              Icons.admin_panel_settings_outlined,
              'Admin',
              Routes.adminUsers,
            ),
          const Divider(indent: 16, endIndent: 16),
          if (user != null)
            ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 24),
              leading: CircleAvatar(
                backgroundImage: Env.imageUrl(user.image) != null
                    ? NetworkImage(Env.imageUrl(user.image)!)
                    : null,
                child: user.image == null ? Text(user.initials) : null,
              ),
              title: Text(user.name.isNotEmpty ? user.name : user.email),
              subtitle: Text(user.email, overflow: TextOverflow.ellipsis),
              trailing: IconButton(
                tooltip: 'Sign out',
                icon: const Icon(Icons.logout),
                onPressed: () async {
                  final confirmed = await confirmAction(
                    context,
                    title: 'Sign out?',
                    message:
                        'You\'ll need to sign in again to use Mail Monkey.',
                    confirmLabel: 'Sign out',
                    destructive: false,
                  );
                  if (confirmed) {
                    await ref.read(authControllerProvider.notifier).signOut();
                  }
                },
              ),
            ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

/// A drawer row with an optional unread badge (NavigationDrawer's own
/// destinations can't show counts or custom icon colours).
class NavigationDrawerDestinationTile extends StatelessWidget {
  const NavigationDrawerDestinationTile({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.selected = false,
    this.count = 0,
    this.iconColor,
    this.iconSize = 24,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool selected;
  final int count;
  final Color? iconColor;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 1),
      child: ListTile(
        dense: true,
        selected: selected,
        selectedTileColor: scheme.secondaryContainer,
        shape: const StadiumBorder(),
        leading: SizedBox(
          width: 24,
          child: Icon(icon, size: iconSize, color: iconColor),
        ),
        title: Text(label, overflow: TextOverflow.ellipsis),
        trailing: count > 0
            ? Text(
                count > 999 ? '999+' : '$count',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: selected
                      ? scheme.onSecondaryContainer
                      : scheme.primary,
                ),
              )
            : null,
        onTap: onTap,
      ),
    );
  }
}

class _MailboxSwitcher extends ConsumerWidget {
  const _MailboxSwitcher();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mailboxes = ref.watch(mailboxesProvider);
    final selected = ref.watch(selectedMailboxProvider);
    return mailboxes.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(16),
        child: LinearProgressIndicator(),
      ),
      error: (e, _) => ListTile(
        leading: const Icon(Icons.error_outline),
        title: const Text('Couldn\'t load mailboxes'),
        trailing: TextButton(
          onPressed: () => ref.invalidate(mailboxesProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (list) {
        if (list.isEmpty || selected == null) {
          return const ListTile(
            leading: Icon(Icons.mail_outline),
            title: Text('No mailbox connected'),
          );
        }
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: PopupMenuButton<Mailbox>(
            tooltip: 'Switch mailbox',
            initialValue: selected,
            onSelected: (m) =>
                ref.read(selectedMailboxIdProvider.notifier).select(m.id),
            itemBuilder: (_) => [
              for (final m in list)
                PopupMenuItem(
                  value: m,
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: _ProviderIcon(mailbox: m),
                    title: Text(m.email, overflow: TextOverflow.ellipsis),
                    subtitle: Text(m.providerLabel),
                  ),
                ),
            ],
            child: ListTile(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              leading: _ProviderIcon(mailbox: selected),
              title: Text(selected.email, overflow: TextOverflow.ellipsis),
              subtitle: Text(selected.providerLabel),
              trailing: list.length > 1 ? const Icon(Icons.unfold_more) : null,
            ),
          ),
        );
      },
    );
  }
}

class _ProviderIcon extends StatelessWidget {
  const _ProviderIcon({required this.mailbox});

  final Mailbox mailbox;

  @override
  Widget build(BuildContext context) => CircleAvatar(
    radius: 18,
    backgroundColor: Theme.of(context).colorScheme.primaryContainer,
    child: Icon(
      mailbox.isImap ? Icons.dns_outlined : Icons.alternate_email,
      size: 18,
    ),
  );
}
