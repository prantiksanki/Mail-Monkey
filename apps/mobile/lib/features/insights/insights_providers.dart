import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../models/insights.dart';
import '../../services/insights_service.dart';

final insightsServiceProvider = Provider<InsightsService>(
  (ref) => InsightsService(ref.watch(apiClientProvider)),
);

final dashboardProvider = FutureProvider.family<DashboardSummary, String>(
  (ref, mailboxId) => ref.watch(insightsServiceProvider).dashboard(mailboxId),
);

final statsProvider = FutureProvider.family<MailboxStats, String>(
  (ref, mailboxId) => ref.watch(insightsServiceProvider).stats(mailboxId),
);

final overviewProvider = FutureProvider<AnalyticsOverview>(
  (ref) => ref.watch(insightsServiceProvider).overview(),
);

final volumeProvider = FutureProvider.family<List<VolumePoint>, int>(
  (ref, days) => ref.watch(insightsServiceProvider).emailVolume(days: days),
);

final topSendersProvider = FutureProvider<List<({String sender, int count})>>(
  (ref) => ref.watch(insightsServiceProvider).topSenders(),
);

final notificationsProvider = FutureProvider<List<AppNotification>>(
  (ref) => ref.watch(insightsServiceProvider).notifications(),
);

final unreadNotificationsProvider = Provider<int>(
  (ref) => (ref.watch(notificationsProvider).value ?? const []).where((n) => !n.isRead).length,
);
