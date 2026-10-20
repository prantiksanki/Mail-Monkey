import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../models/insights.dart';
import '../../shared/widgets/app_drawer.dart';
import '../../shared/widgets/state_views.dart';
import '../mail/compose/compose_screen.dart';
import '../mail/mail_providers.dart';
import '../mail/message_actions.dart';
import 'insights_providers.dart';

final _calendarProvider = FutureProvider.family<CalendarResult, ({String mailboxId, int days})>((ref, key) {
  final now = DateTime.now();
  final start = DateTime(now.year, now.month, now.day);
  return ref
      .watch(insightsServiceProvider)
      .calendarEvents(key.mailboxId, from: start, to: start.add(Duration(days: key.days)));
});

/// Upcoming events (web `/app/calendar`) with event/meeting creation.
class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  int _days = 14;

  @override
  Widget build(BuildContext context) {
    final mailbox = ref.watch(selectedMailboxProvider);
    final key = mailbox == null ? null : (mailboxId: mailbox.id, days: _days);
    return Scaffold(
      drawer: const AppDrawer(selected: 'calendar'),
      appBar: AppBar(
        title: const Text('Calendar'),
        actions: [
          PopupMenuButton<int>(
            tooltip: 'Range',
            initialValue: _days,
            icon: const Icon(Icons.date_range_outlined),
            onSelected: (d) => setState(() => _days = d),
            itemBuilder: (_) => const [
              PopupMenuItem(value: 7, child: Text('Next 7 days')),
              PopupMenuItem(value: 14, child: Text('Next 14 days')),
              PopupMenuItem(value: 30, child: Text('Next 30 days')),
            ],
          ),
        ],
      ),
      floatingActionButton: mailbox == null
          ? null
          : FloatingActionButton.extended(
              onPressed: () async {
                final created = await showModalBottomSheet<bool>(
                  context: context,
                  isScrollControlled: true,
                  showDragHandle: true,
                  builder: (_) => _NewEventSheet(mailboxId: mailbox.id),
                );
                if (created == true && key != null) ref.invalidate(_calendarProvider(key));
              },
              icon: const Icon(Icons.add),
              label: const Text('New event'),
            ),
      body: key == null
          ? const EmptyView(icon: Icons.calendar_month_outlined, title: 'Connect a mailbox to see your calendar')
          : ref.watch(_calendarProvider(key)).when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(_calendarProvider(key))),
              data: (result) {
                if (result.serviceDisabled) {
                  return const EmptyView(
                    icon: Icons.event_busy_outlined,
                    title: 'Calendar isn\'t enabled',
                    message: 'The calendar service is turned off for this mailbox\'s Google project.',
                  );
                }
                if (result.needsReconnect) {
                  return const EmptyView(
                    icon: Icons.link_off,
                    title: 'Calendar access needed',
                    message: 'Grant calendar access by reconnecting this mailbox on the Mail Monkey website. '
                        'Reconnecting from the app isn\'t supported yet.',
                  );
                }
                return RefreshIndicator(
                  onRefresh: () => ref.refresh(_calendarProvider(key).future),
                  child: _Agenda(result: result),
                );
              },
            ),
    );
  }
}

class _Agenda extends StatelessWidget {
  const _Agenda({required this.result});

  final CalendarResult result;

  @override
  Widget build(BuildContext context) {
    final events = [...result.events]..sort((a, b) => (a.start ?? DateTime(0)).compareTo(b.start ?? DateTime(0)));
    if (events.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(
            height: 360,
            child: EmptyView(
              icon: Icons.event_available_outlined,
              title: 'No upcoming events',
              message: result.calendarError,
            ),
          ),
        ],
      );
    }
    final groups = <DateTime, List<CalendarEvent>>{};
    for (final e in events) {
      final s = e.start ?? DateTime.now();
      groups.putIfAbsent(DateTime(s.year, s.month, s.day), () => []).add(e);
    }
    final theme = Theme.of(context);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 96),
      children: [
        for (final entry in groups.entries) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
            child: Text(
              DateFormat('EEEE, d MMMM').format(entry.key),
              style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.primary),
            ),
          ),
          for (final e in entry.value)
            ListTile(
              leading: const Icon(Icons.event_outlined),
              title: Text(e.summary),
              subtitle: Text(
                [
                  if (e.isAllDay) 'All day'
                  else '${e.start != null ? DateFormat.jm().format(e.start!) : ''} – ${e.end != null ? DateFormat.jm().format(e.end!) : ''}',
                  if (e.location != null && e.location!.isNotEmpty) e.location!,
                ].join(' · '),
              ),
              onTap: e.location != null && Uri.tryParse(e.location!)?.hasScheme == true
                  ? () => launchUrl(Uri.parse(e.location!), mode: LaunchMode.externalApplication)
                  : null,
            ),
        ],
      ],
    );
  }
}

class _NewEventSheet extends ConsumerStatefulWidget {
  const _NewEventSheet({required this.mailboxId});

  final String mailboxId;

  @override
  ConsumerState<_NewEventSheet> createState() => _NewEventSheetState();
}

class _NewEventSheetState extends ConsumerState<_NewEventSheet> {
  final _title = TextEditingController();
  final _attendees = TextEditingController();
  final _description = TextEditingController();
  late DateTime _start = _roundedNextHour();
  Duration _length = const Duration(minutes: 30);
  bool _allDay = false;
  bool _meeting = false;
  String _provider = 'google';
  bool _busy = false;

  static DateTime _roundedNextHour() {
    final n = DateTime.now().add(const Duration(hours: 1));
    return DateTime(n.year, n.month, n.day, n.hour);
  }

  @override
  void dispose() {
    _title.dispose();
    _attendees.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_title.text.trim().isEmpty) {
      showMessage(context, 'Add a title', error: true);
      return;
    }
    final attendeesError = validateRecipients(_attendees.text);
    if (attendeesError != null) {
      showMessage(context, attendeesError, error: true);
      return;
    }
    final attendees = _attendees.text.split(RegExp('[,;]')).map((a) => a.trim()).where((a) => a.isNotEmpty).toList();
    setState(() => _busy = true);
    final service = ref.read(insightsServiceProvider);
    try {
      String status;
      String? link;
      if (_meeting) {
        final r = await service.createMeeting(
          widget.mailboxId,
          summary: _title.text.trim(),
          start: _start,
          end: _start.add(_length),
          provider: _provider,
          attendees: attendees,
          description: _description.text.trim(),
        );
        status = r.status;
        link = r.meetLink;
      } else {
        status = await service.createEvent(
          widget.mailboxId,
          summary: _title.text.trim(),
          start: _start,
          end: _allDay ? _start.add(const Duration(days: 1)) : _start.add(_length),
          allDay: _allDay,
          attendees: attendees,
          description: _description.text.trim(),
        );
      }
      if (!mounted) return;
      switch (status) {
        case 'ok':
          showMessage(context, link != null ? 'Meeting created: $link' : 'Event created');
          Navigator.of(context).pop(true);
        case 'needsReconnect':
          showMessage(context, 'Reconnect this mailbox on the website to grant calendar access.', error: true);
        case 'serviceDisabled':
          showMessage(context, 'The calendar service isn\'t enabled for this account.', error: true);
        default:
          showMessage(context, 'Couldn\'t create the event. Please try again.', error: true);
      }
    } catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          children: [
            Text('New event', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            TextField(controller: _title, decoration: const InputDecoration(labelText: 'Title'), textCapitalization: TextCapitalization.sentences),
            const SizedBox(height: 12),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Video meeting'),
              value: _meeting,
              onChanged: (v) => setState(() {
                _meeting = v;
                if (v) _allDay = false;
              }),
            ),
            if (_meeting)
              DropdownButtonFormField<String>(
                initialValue: _provider,
                decoration: const InputDecoration(labelText: 'Meeting provider'),
                items: const [
                  DropdownMenuItem(value: 'google', child: Text('Google Meet')),
                  DropdownMenuItem(value: 'zoom', child: Text('Zoom')),
                  DropdownMenuItem(value: 'zoho', child: Text('Zoho Meeting')),
                  DropdownMenuItem(value: 'outlook', child: Text('Microsoft Teams (Outlook)')),
                ],
                onChanged: (v) => setState(() => _provider = v ?? 'google'),
              )
            else
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('All day'),
                value: _allDay,
                onChanged: (v) => setState(() => _allDay = v),
              ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.schedule),
              title: Text(_allDay ? DateFormat('EEE, d MMM y').format(_start) : DateFormat('EEE, d MMM y · HH:mm').format(_start)),
              trailing: const Icon(Icons.edit_outlined),
              onTap: () async {
                final picked = await pickDateTime(context, initial: _start);
                if (picked != null) setState(() => _start = picked);
              },
            ),
            if (!_allDay)
              DropdownButtonFormField<Duration>(
                initialValue: _length,
                decoration: const InputDecoration(labelText: 'Duration'),
                items: const [
                  DropdownMenuItem(value: Duration(minutes: 15), child: Text('15 minutes')),
                  DropdownMenuItem(value: Duration(minutes: 30), child: Text('30 minutes')),
                  DropdownMenuItem(value: Duration(minutes: 45), child: Text('45 minutes')),
                  DropdownMenuItem(value: Duration(hours: 1), child: Text('1 hour')),
                  DropdownMenuItem(value: Duration(minutes: 90), child: Text('1.5 hours')),
                  DropdownMenuItem(value: Duration(hours: 2), child: Text('2 hours')),
                ],
                onChanged: (v) => setState(() => _length = v ?? _length),
              ),
            const SizedBox(height: 12),
            TextField(
              controller: _attendees,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Attendees (comma-separated, optional)'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _description,
              minLines: 2,
              maxLines: 5,
              decoration: const InputDecoration(labelText: 'Description (optional)'),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _busy ? null : _save,
              child: _busy
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(_meeting ? 'Create meeting' : 'Create event'),
            ),
          ],
        ),
      ),
    );
  }
}
