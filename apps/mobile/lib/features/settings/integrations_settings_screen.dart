import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../shared/widgets/state_views.dart';
import 'settings_providers.dart';
import 'settings_widgets.dart';

/// Settings → Integrations (web IntegrationsSettings + TelegramConnectBlock).
/// Gmail/Outlook mailboxes are managed under Settings → Mailboxes.
class IntegrationsSettingsScreen extends StatelessWidget {
  const IntegrationsSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Integrations')),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        _TelegramSection(),
        _MeetingProviderSection(
          provider: 'zoom',
          name: 'Zoom',
          description: 'Create Zoom links for meetings and bookings.',
        ),
        _MeetingProviderSection(
          provider: 'zoho',
          name: 'Zoho Meeting',
          description: 'Create Zoho Meeting links for meetings and bookings.',
        ),
      ],
    ),
  );
}

class _TelegramSection extends ConsumerStatefulWidget {
  const _TelegramSection();

  @override
  ConsumerState<_TelegramSection> createState() => _TelegramSectionState();
}

class _TelegramSectionState extends ConsumerState<_TelegramSection> with WidgetsBindingObserver {
  Timer? _poll;
  DateTime? _linkExpiry;
  String? _baseline;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _poll?.cancel();
    super.dispose();
  }

  /// Back from Telegram — check whether the chat got connected.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _linkExpiry != null) ref.invalidate(telegramStatusProvider);
  }

  Future<void> _connect() async {
    try {
      _baseline = ref.read(telegramStatusProvider).value?.updatedAt;
      final link = await ref.read(integrationsServiceProvider).telegramLink();
      _linkExpiry = link.expiresAt ?? DateTime.now().add(const Duration(minutes: 15));
      _poll?.cancel();
      // Same idea as the web QR flow: poll until the chat is linked or the
      // 15-minute link expires.
      _poll = Timer.periodic(const Duration(seconds: 3), (_) async {
        if (DateTime.now().isAfter(_linkExpiry!)) {
          _poll?.cancel();
          _linkExpiry = null;
          return;
        }
        final status = await ref.refresh(telegramStatusProvider.future);
        if (status.connected && status.updatedAt != _baseline) {
          _poll?.cancel();
          _linkExpiry = null;
          if (mounted) showMessage(context, 'Telegram connected');
        }
      });
      await launchUrl(Uri.parse(link.url), mode: LaunchMode.externalApplication);
    } on Exception {
      if (mounted) showMessage(context, 'Could not create a Telegram link', error: true);
    }
  }

  Future<void> _setDelivery({required bool enabled}) async {
    try {
      final service = ref.read(integrationsServiceProvider);
      await (enabled ? service.telegramResume() : service.telegramPause());
      ref.invalidate(telegramStatusProvider);
      if (mounted) showMessage(context, enabled ? 'Telegram delivery resumed' : 'Telegram delivery paused');
    } on Exception {
      if (mounted) showMessage(context, 'Could not update Telegram delivery', error: true);
    }
  }

  @override
  Widget build(BuildContext context) => SettingsSection(
    title: 'Telegram',
    description: 'Get a daily digest and important alerts in Telegram.',
    child: ref.watch(telegramStatusProvider).when(
      loading: () => const LinearProgressIndicator(),
      error: (e, _) => Text('Could not load Telegram status: ${errorMessage(e)}'),
      data: (s) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (s.connected) ...[
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.send),
              title: Text(s.displayName),
              subtitle: Text(
                s.enabled
                    ? 'Delivering · daily digest at ${s.dailyDigestTime} (${s.timezone})'
                    : 'Delivery paused',
              ),
            ),
            Wrap(
              spacing: 8,
              children: [
                if (s.enabled)
                  OutlinedButton(onPressed: () => _setDelivery(enabled: false), child: const Text('Pause'))
                else
                  FilledButton(onPressed: () => _setDelivery(enabled: true), child: const Text('Resume')),
                TextButton(onPressed: _connect, child: const Text('Reconnect')),
              ],
            ),
          ] else ...[
            const Text('Not connected'),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: FilledButton.icon(
                onPressed: _connect,
                icon: const Icon(Icons.send),
                label: const Text('Connect Telegram'),
              ),
            ),
          ],
        ],
      ),
    ),
  );
}

class _MeetingProviderSection extends ConsumerWidget {
  const _MeetingProviderSection({required this.provider, required this.name, required this.description});

  final String provider;
  final String name;
  final String description;

  @override
  Widget build(BuildContext context, WidgetRef ref) => SettingsSection(
    title: name,
    description: description,
    child: ref.watch(meetingProviderStatusProvider(provider)).when(
      loading: () => const LinearProgressIndicator(),
      error: (e, _) => Text(errorMessage(e)),
      data: (s) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(s.connected ? 'Connected' : (s.configured ? 'Not connected' : 'Not available on this server')),
          const SizedBox(height: 8),
          if (s.connected)
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton(
                onPressed: () async {
                  final ok = await confirmAction(
                    context,
                    title: 'Disconnect $name?',
                    message: 'You can reconnect it from the web app.',
                    confirmLabel: 'Disconnect',
                  );
                  if (!ok) return;
                  try {
                    await ref.read(integrationsServiceProvider).meetingDisconnect(provider);
                    ref.invalidate(meetingProviderStatusProvider(provider));
                    if (context.mounted) showMessage(context, '$name disconnected');
                  } on Exception {
                    if (context.mounted) showMessage(context, 'Could not disconnect $name', error: true);
                  }
                },
                child: const Text('Disconnect'),
              ),
            )
          else if (s.configured)
            BlockedNotice('Connecting $name uses an OAuth browser flow that is only available on the web app.'),
        ],
      ),
    ),
  );
}
