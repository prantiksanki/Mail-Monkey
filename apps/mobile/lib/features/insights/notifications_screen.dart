import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/routes.dart';
import '../../models/insights.dart';
import '../../shared/utils/format.dart';
import '../../shared/widgets/app_drawer.dart';
import '../../shared/widgets/state_views.dart';
import 'insights_providers.dart';

/// In-app notifications (web Notifications panel). There is no push
/// notification service in the backend, so these are fetched on open.
class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  Future<void> _open(BuildContext context, WidgetRef ref, AppNotification n) async {
    if (!n.isRead) {
      try {
        await ref.read(insightsServiceProvider).markNotificationRead(n.id);
        ref.invalidate(notificationsProvider);
      } catch (e) {
        if (context.mounted) showMessage(context, errorMessage(e), error: true);
      }
    }
    if (n.emailId != null && context.mounted) {
      await context.push(Routes.messagePath(n.emailId!));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      drawer: const AppDrawer(selected: 'notifications'),
      appBar: AppBar(title: const Text('Notifications')),
      body: ref.watch(notificationsProvider).when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(notificationsProvider)),
        data: (items) => RefreshIndicator(
          onRefresh: () => ref.refresh(notificationsProvider.future),
          child: items.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: const [
                    SizedBox(height: 360, child: EmptyView(icon: Icons.notifications_none, title: 'No notifications')),
                  ],
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final n = items[i];
                    return ListTile(
                      leading: Icon(
                        n.isRead ? Icons.notifications_none : Icons.notifications_active,
                        color: n.isRead ? null : Theme.of(context).colorScheme.primary,
                      ),
                      title: Text(n.title, style: TextStyle(fontWeight: n.isRead ? FontWeight.w400 : FontWeight.w700)),
                      subtitle: Text(n.body, maxLines: 3, overflow: TextOverflow.ellipsis),
                      trailing: Text(formatListDate(n.createdAt), style: Theme.of(context).textTheme.labelSmall),
                      onTap: () => _open(context, ref, n),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
