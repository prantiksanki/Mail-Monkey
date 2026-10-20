import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../models/mail_items.dart';
import '../../../models/message.dart';
import '../../../shared/utils/format.dart';
import '../../../shared/widgets/state_views.dart';
import '../mail_providers.dart';
import '../message/email_html.dart';
import '../message_actions.dart';

/// What to pre-fill the compose screen with.
class ComposeArgs {
  const ComposeArgs({
    this.to = '',
    this.cc = '',
    this.bcc = '',
    this.subject = '',
    this.body = '',
    this.forwardHtml,
    this.draftId,
  });

  /// Reply to the sender, like the web (`Re: <subject>`, empty body).
  factory ComposeArgs.reply(MessageDetail message) => ComposeArgs(
    to: message.header('reply-to')?.isNotEmpty == true
        ? message.header('reply-to')!
        : message.fromEmail,
    subject: message.subject.toLowerCase().startsWith('re:')
        ? message.subject
        : 'Re: ${message.subject}',
  );

  /// Forward with the original quoted in a Gmail-style block.
  factory ComposeArgs.forward(MessageDetail message) => ComposeArgs(
    subject: 'Fwd: ${message.subject}',
    forwardHtml: buildForwardHtml(
      from: message.from.isNotEmpty ? '${message.from} <${message.fromEmail}>' : message.fromEmail,
      to: message.to,
      subject: message.subject,
      date: formatFullDate(message.date),
      bodyHtml: message.bodyHtml,
      bodyText: message.bodyText,
    ),
  );

  final String to;
  final String cc;
  final String bcc;
  final String subject;
  final String body;

  /// Forwarded message block appended (as HTML) below the user's note.
  final String? forwardHtml;

  /// Editing an existing draft.
  final String? draftId;
}

final _emailPattern = RegExp(r'^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$');

/// Validates a comma-separated recipient list (`A <a@x.com>, b@y.com`).
String? validateRecipients(String value, {bool required = false}) {
  final parts = value.split(RegExp('[,;]')).map((p) => p.trim()).where((p) => p.isNotEmpty);
  if (parts.isEmpty) return required ? 'Add at least one recipient' : null;
  for (final part in parts) {
    final address = firstEmailAddress(part);
    if (!_emailPattern.hasMatch(address)) return 'Invalid address: $part';
  }
  return null;
}

class ComposeScreen extends ConsumerStatefulWidget {
  const ComposeScreen({super.key, this.args = const ComposeArgs()});

  final ComposeArgs args;

  @override
  ConsumerState<ComposeScreen> createState() => _ComposeScreenState();
}

class _ComposeScreenState extends ConsumerState<ComposeScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _to = TextEditingController(text: widget.args.to);
  late final _cc = TextEditingController(text: widget.args.cc);
  late final _bcc = TextEditingController(text: widget.args.bcc);
  late final _subject = TextEditingController(text: widget.args.subject);
  late final _body = TextEditingController(text: widget.args.body);
  late bool _showCcBcc = widget.args.cc.isNotEmpty || widget.args.bcc.isNotEmpty;
  late String? _draftId = widget.args.draftId;
  bool _busy = false;
  bool _done = false;

  @override
  void dispose() {
    for (final c in [_to, _cc, _bcc, _subject, _body]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _hasContent =>
      _to.text.trim().isNotEmpty ||
      _subject.text.trim().isNotEmpty ||
      _body.text.trim().isNotEmpty;

  OutgoingEmail _email() {
    final note = _body.text;
    final forward = widget.args.forwardHtml;
    return OutgoingEmail(
      to: _to.text.trim(),
      cc: _cc.text.trim(),
      bcc: _bcc.text.trim(),
      subject: _subject.text.trim(),
      // A forward is sent as HTML (note + quoted original), like the web.
      body: forward == null ? note : '<p>${plainTextToHtml(note)}</p><br>$forward',
    );
  }

  bool _validate() {
    if (!(_formKey.currentState?.validate() ?? false)) return false;
    if (_body.text.trim().isEmpty && widget.args.forwardHtml == null) {
      showMessage(context, 'Write a message before sending.', error: true);
      return false;
    }
    return true;
  }

  Future<void> _send() async {
    final mailbox = ref.read(selectedMailboxProvider);
    if (mailbox == null || !_validate()) return;
    setState(() => _busy = true);
    final mail = ref.read(mailServiceProvider);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final pending = await mail.sendWithUndo(mailbox.id, _email());
      if (_draftId != null) {
        unawaited(mail.deleteDraft(mailbox.id, _draftId!).catchError((Object _) {}));
      }
      _done = true;
      messenger.showSnackBar(
        SnackBar(
          content: const Text('Sending…'),
          duration: const Duration(seconds: 5),
          action: SnackBarAction(
            label: 'Undo',
            onPressed: () async {
              try {
                await mail.cancelScheduled(mailbox.id, pending.scheduledEmailId);
                messenger.showSnackBar(const SnackBar(content: Text('Sending cancelled')));
              } catch (_) {
                messenger.showSnackBar(const SnackBar(content: Text('Too late — the email was already sent')));
              }
            },
          ),
        ),
      );
      if (mounted) context.pop();
    } catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _schedule() async {
    final mailbox = ref.read(selectedMailboxProvider);
    if (mailbox == null || !_validate()) return;
    final at = await pickDateTime(context, initial: DateTime.now().add(const Duration(hours: 1)));
    if (at == null || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref.read(mailServiceProvider).schedule(mailbox.id, _email(), at);
      _done = true;
      if (!mounted) return;
      showMessage(context, 'Scheduled for ${formatUpcoming(at)}');
      context.pop();
    } catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _saveDraft({bool quiet = false}) async {
    final mailbox = ref.read(selectedMailboxProvider);
    if (mailbox == null) return false;
    try {
      _draftId = await ref.read(mailServiceProvider).saveDraft(mailbox.id, _email(), draftId: _draftId);
      if (mounted && !quiet) showMessage(context, 'Draft saved');
      return true;
    } catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
      return false;
    }
  }

  Future<void> _onPopInvoked(bool didPop) async {
    if (didPop || _done) return;
    if (!_hasContent) {
      if (mounted) context.pop();
      return;
    }
    final choice = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Save this draft?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop('discard'), child: const Text('Discard')),
          TextButton(onPressed: () => Navigator.of(context).pop('cancel'), child: const Text('Keep editing')),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(0, 40)),
            onPressed: () => Navigator.of(context).pop('save'),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (!mounted || choice == null || choice == 'cancel') return;
    if (choice == 'save' && !await _saveDraft(quiet: true)) return;
    _done = true;
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final mailbox = ref.watch(selectedMailboxProvider);
    return PopScope(
      canPop: _done || !_hasContent,
      onPopInvokedWithResult: (didPop, _) => _onPopInvoked(didPop),
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Compose'),
          actions: [
            IconButton(
              tooltip: 'Schedule send',
              icon: const Icon(Icons.schedule_send_outlined),
              onPressed: _busy ? null : _schedule,
            ),
            IconButton(
              tooltip: 'Send',
              icon: _busy
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.send),
              onPressed: _busy ? null : _send,
            ),
            PopupMenuButton<String>(
              onSelected: (v) {
                if (v == 'draft') unawaited(_saveDraft());
              },
              itemBuilder: (_) => const [PopupMenuItem(value: 'draft', child: Text('Save draft'))],
            ),
          ],
        ),
        body: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (mailbox != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text('From: ${mailbox.email}', style: Theme.of(context).textTheme.bodySmall),
                ),
              TextFormField(
                controller: _to,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: InputDecoration(
                  labelText: 'To',
                  suffixIcon: _showCcBcc
                      ? null
                      : TextButton(onPressed: () => setState(() => _showCcBcc = true), child: const Text('Cc/Bcc')),
                ),
                validator: (v) => validateRecipients(v ?? '', required: true),
              ),
              if (_showCcBcc) ...[
                const SizedBox(height: 12),
                TextFormField(
                  controller: _cc,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Cc'),
                  validator: (v) => validateRecipients(v ?? ''),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _bcc,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Bcc'),
                  validator: (v) => validateRecipients(v ?? ''),
                ),
              ],
              const SizedBox(height: 12),
              TextFormField(
                controller: _subject,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(labelText: 'Subject'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Subject is required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _body,
                minLines: 10,
                maxLines: null,
                keyboardType: TextInputType.multiline,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  hintText: widget.args.forwardHtml == null ? 'Write your message' : 'Add a note (optional)',
                  alignLabelWithHint: true,
                ),
              ),
              if (widget.args.forwardHtml != null) ...[
                const SizedBox(height: 12),
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.forward_to_inbox_outlined),
                    title: const Text('Forwarded message included'),
                    subtitle: Text(widget.args.subject.replaceFirst('Fwd: ', '')),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
