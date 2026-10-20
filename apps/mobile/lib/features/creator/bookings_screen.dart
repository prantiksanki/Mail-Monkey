import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../models/creator.dart';
import '../../shared/utils/format.dart';
import '../../shared/widgets/app_drawer.dart';
import '../../shared/widgets/state_views.dart';
import '../settings/settings_providers.dart';

/// Meetings booked through the public page (web BookingsPage).
class BookingsScreen extends ConsumerStatefulWidget {
  const BookingsScreen({super.key});

  @override
  ConsumerState<BookingsScreen> createState() => _BookingsScreenState();
}

class _BookingsScreenState extends ConsumerState<BookingsScreen> {
  String? _busy;

  Future<void> _accept(Booking b) async {
    setState(() => _busy = b.id);
    try {
      final status = await ref.read(creatorServiceProvider).acceptBooking(b.id);
      if (!mounted) return;
      final (message, isError) = switch (status) {
        'ok' => ('Booking confirmed — meeting created and email sent.', false),
        'needsGoogleMailbox' || 'needsReconnect' => (
          'Connect a Google mailbox (with Calendar access) to accept bookings.',
          true,
        ),
        'serviceDisabled' => ("Google Calendar isn't enabled for this account.", true),
        'emailFailed' => (
          'Meeting created, but the confirmation email failed. Tap Accept again to retry sending it.',
          true,
        ),
        _ => ("Couldn't create the meeting. Try again.", true),
      };
      showMessage(context, message, error: isError);
    } on Exception {
      if (mounted) showMessage(context, 'Something went wrong.', error: true);
    } finally {
      ref.invalidate(bookingsProvider);
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _decline(Booking b) async {
    final ok = await confirmAction(
      context,
      title: 'Decline booking?',
      message: '${b.visitorName} will be told you can’t make it.',
      confirmLabel: 'Decline',
    );
    if (!ok) return;
    setState(() => _busy = b.id);
    try {
      await ref.read(creatorServiceProvider).declineBooking(b.id);
      if (mounted) showMessage(context, 'Booking declined.');
    } on Exception {
      if (mounted) showMessage(context, "Couldn't decline the booking. Try again.", error: true);
    } finally {
      ref.invalidate(bookingsProvider);
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      drawer: const AppDrawer(selected: 'bookings'),
      appBar: AppBar(title: const Text('Bookings')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(bookingsProvider.future),
        child: ref.watch(bookingsProvider).when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(bookingsProvider)),
          data: (items) => items.isEmpty
              ? ListView(
                  children: const [
                    SizedBox(height: 80),
                    EmptyView(
                      icon: Icons.event_available_outlined,
                      title: 'No bookings yet',
                      message: 'Upcoming meetings booked through your public page appear here.',
                    ),
                  ],
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: items.length,
                  itemBuilder: (context, i) {
                    final b = items[i];
                    final busy = _busy == b.id;
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          spacing: 4,
                          children: [
                            Text(formatFullDate(b.startsAt), style: theme.textTheme.titleSmall),
                            Text('${b.visitorName} · ${b.visitorEmail}'),
                            if (b.note != null && b.note!.isNotEmpty)
                              Text(b.note!, style: theme.textTheme.bodySmall),
                            Text(
                              b.paid ? '${b.statusLabel} · Paid' : b.statusLabel,
                              style: theme.textTheme.labelMedium?.copyWith(
                                color: b.status == 'CONFIRMED' ? Colors.green : theme.colorScheme.tertiary,
                              ),
                            ),
                            if (b.status == 'CONFIRMED')
                              b.meetLink != null
                                  ? TextButton.icon(
                                      style: TextButton.styleFrom(padding: EdgeInsets.zero),
                                      onPressed: () =>
                                          launchUrl(Uri.parse(b.meetLink!), mode: LaunchMode.externalApplication),
                                      icon: const Icon(Icons.videocam_outlined),
                                      label: const Text('Join Google Meet'),
                                    )
                                  : Text(
                                      'No meeting link — this booking was confirmed before the meeting workflow was added.',
                                      style: theme.textTheme.bodySmall,
                                    ),
                            if (b.isPending)
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  TextButton(onPressed: busy ? null : () => _decline(b), child: const Text('Decline')),
                                  const SizedBox(width: 8),
                                  FilledButton(
                                    onPressed: busy ? null : () => _accept(b),
                                    child: busy
                                        ? const SizedBox.square(
                                            dimension: 16,
                                            child: CircularProgressIndicator(strokeWidth: 2),
                                          )
                                        : const Text('Accept'),
                                  ),
                                ],
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
