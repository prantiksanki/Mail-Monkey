import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/routes.dart';
import '../../models/message.dart';
import '../../services/ai_service.dart';
import '../auth/auth_controller.dart';
import '../insights/insights_providers.dart';
import '../mail/compose/compose_screen.dart';
import '../mail/message/email_html.dart';
import '../mail/message_actions.dart';
import '../../shared/widgets/state_views.dart';
import 'ai_providers.dart';

const _tones = ['professional', 'friendly', 'formal'];

const _toneLabels = {'professional': 'Professional', 'friendly': 'Friendly', 'formal': 'Formal'};

const _confidenceLabels = {'high': 'High confidence', 'medium': 'Medium confidence', 'low': 'Low confidence'};

const _meetingProviders = {'google': 'Google Meet', 'zoom': 'Zoom', 'zoho': 'Zoho Meeting', 'outlook': 'Teams'};

const _reconnectHints = {
  'google': 'Reconnect Google (with calendar access) to create Meet links.',
  'zoom': 'Connect Zoom in Settings → Integrations to create Zoom links.',
  'zoho': 'Connect Zoho in Settings → Integrations to create Zoho Meeting links.',
  'outlook': 'Connect an Outlook mailbox to create Teams links.',
};

/// AI reply drafts for an email (web AiDraftPanel): three tones, detected
/// intent, optional meeting link, then "Use draft" opens the composer.
Future<void> showAiDraftSheet(BuildContext context, {required String mailboxId, required MessageDetail message}) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => _AiDraftSheet(mailboxId: mailboxId, message: message),
    );

class _AiDraftSheet extends ConsumerStatefulWidget {
  const _AiDraftSheet({required this.mailboxId, required this.message});

  final String mailboxId;
  final MessageDetail message;

  @override
  ConsumerState<_AiDraftSheet> createState() => _AiDraftSheetState();
}

class _AiDraftSheetState extends ConsumerState<_AiDraftSheet> {
  bool _loading = false;
  bool _creatingMeet = false;
  String? _intent;
  List<AiReplyDraft>? _drafts;
  String _tone = 'professional';
  String? _meetLink;
  String _provider = 'google';
  int _duration = 30;

  String get _replyTo => pickEmail([widget.message.fromEmail, widget.message.from]);

  Future<void> _generate() async {
    final m = widget.message;
    final body = m.bodyText.trim().isNotEmpty ? m.bodyText : htmlToText(m.bodyHtml);
    if (body.isEmpty) {
      showMessage(context, 'This email has no readable text to reply to.', error: true);
      return;
    }
    setState(() => _loading = true);
    try {
      final user = ref.read(authControllerProvider).value?.user;
      final result = await ref.read(aiServiceProvider).generateDrafts(
        mailboxId: widget.mailboxId,
        body: body,
        subject: m.subject.isEmpty ? null : m.subject,
        fromName: m.from.isEmpty ? null : m.from,
        fromEmail: m.fromEmail.isEmpty ? null : m.fromEmail,
        senderName: (user?.name.isEmpty ?? true) ? null : user!.name,
      );
      setState(() {
        _intent = result.intent;
        _drafts = result.drafts;
        _tone = 'professional';
      });
    } on Exception catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _addMeeting() async {
    final start = await pickDateTime(context, initial: DateTime.now().add(const Duration(hours: 1)));
    if (start == null || !mounted) return;
    if (!start.isAfter(DateTime.now())) {
      showMessage(context, 'Pick a meeting time in the future.', error: true);
      return;
    }
    final label = _meetingProviders[_provider]!;
    setState(() => _creatingMeet = true);
    try {
      final subject = widget.message.subject;
      final result = await ref.read(insightsServiceProvider).createMeeting(
        widget.mailboxId,
        provider: _provider,
        summary: subject.isEmpty ? 'Meeting' : 'Meeting: $subject',
        start: start,
        end: start.add(Duration(minutes: _duration)),
        attendees: [if (_replyTo.isNotEmpty) _replyTo],
      );
      if (!mounted) return;
      switch (result.status) {
        case 'ok' when result.meetLink != null:
          setState(() => _meetLink = result.meetLink);
          showMessage(context, '$label link created');
        case 'needsReconnect':
          showMessage(context, _reconnectHints[_provider]!, error: true);
        case 'serviceDisabled':
          showMessage(context, 'Google Calendar API is disabled for this project.', error: true);
        default:
          showMessage(context, 'Could not create a $label link.', error: true);
      }
    } on Exception {
      if (mounted) showMessage(context, 'Could not create a $label link.', error: true);
    } finally {
      if (mounted) setState(() => _creatingMeet = false);
    }
  }

  void _use(AiReplyDraft draft) {
    final subject = widget.message.subject;
    final body = _meetLink == null ? draft.body : '${draft.body}\n\nJoin the meeting: $_meetLink';
    final router = GoRouter.of(context);
    Navigator.pop(context);
    router.push(
      Routes.compose,
      extra: ComposeArgs(
        to: _replyTo,
        subject: subject.toLowerCase().startsWith('re:') ? subject : 'Re: $subject'.trim(),
        body: body,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final drafts = _drafts;
    final active = drafts?.where((d) => d.tone == _tone).firstOrNull ?? drafts?.firstOrNull;

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      builder: (context, scroll) => ListView(
        controller: scroll,
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        children: [
          Row(
            children: [
              Icon(Icons.auto_awesome, color: theme.colorScheme.primary),
              const SizedBox(width: 8),
              Text('AI draft', style: theme.textTheme.titleMedium),
              const Spacer(),
              if (drafts != null) Text('${drafts.length} drafts ready', style: theme.textTheme.labelMedium),
            ],
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Column(
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Reading the email and generating 3 draft variants…'),
                ],
              ),
            )
          else if (active == null)
            Column(
              children: [
                const Text('Generate reply drafts in three tones based on this email.', textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _generate,
                  icon: const Icon(Icons.auto_awesome),
                  label: const Text('Generate draft'),
                ),
              ],
            )
          else ...[
            if (_intent != null && _intent!.isNotEmpty)
              Card(
                margin: EdgeInsets.zero,
                child: ListTile(
                  dense: true,
                  title: const Text('Detected intent'),
                  subtitle: Text(_intent!),
                ),
              ),
            const SizedBox(height: 12),
            SegmentedButton<String>(
              segments: [
                for (final t in _tones)
                  if (drafts!.any((d) => d.tone == t)) ButtonSegment(value: t, label: Text(_toneLabels[t]!)),
              ],
              selected: {active.tone},
              onSelectionChanged: (s) => setState(() => _tone = s.first),
            ),
            const SizedBox(height: 12),
            if (active.confidence.isNotEmpty)
              Text(
                _confidenceLabels[active.confidence] ?? active.confidence,
                style: theme.textTheme.labelMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
            const SizedBox(height: 8),
            Text('To: ${_replyTo.isEmpty ? '—' : _replyTo}', style: theme.textTheme.bodySmall),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                border: Border.all(color: theme.colorScheme.outlineVariant),
                borderRadius: BorderRadius.circular(12),
              ),
              child: SelectableText(active.body),
            ),
            const SizedBox(height: 16),
            Text('Add a meeting link', style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            if (_meetLink != null)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.videocam_outlined),
                title: Text(_meetLink!, maxLines: 1, overflow: TextOverflow.ellipsis),
                trailing: IconButton(
                  tooltip: 'Remove',
                  icon: const Icon(Icons.close),
                  onPressed: () => setState(() => _meetLink = null),
                ),
              )
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  DropdownButton<String>(
                    value: _provider,
                    items: [
                      for (final e in _meetingProviders.entries) DropdownMenuItem(value: e.key, child: Text(e.value)),
                    ],
                    onChanged: (v) => setState(() => _provider = v ?? _provider),
                  ),
                  DropdownButton<int>(
                    value: _duration,
                    items: [for (final d in const [15, 30, 45, 60]) DropdownMenuItem(value: d, child: Text('$d min'))],
                    onChanged: (v) => setState(() => _duration = v ?? _duration),
                  ),
                  OutlinedButton.icon(
                    onPressed: _creatingMeet ? null : _addMeeting,
                    icon: _creatingMeet
                        ? const SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.videocam_outlined),
                    label: const Text('Pick time'),
                  ),
                ],
              ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _generate,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Regenerate'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => _use(active),
                    icon: const Icon(Icons.check),
                    label: const Text('Use draft'),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
