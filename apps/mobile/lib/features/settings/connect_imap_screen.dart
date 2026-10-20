import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/account.dart';
import '../../shared/widgets/state_views.dart';
import '../mail/mail_providers.dart';
import 'settings_providers.dart';
import 'settings_widgets.dart';

/// Connect a custom (IMAP/SMTP) mailbox (web ConnectMailboxForm): verify the
/// credentials, then connect.
class ConnectImapScreen extends ConsumerStatefulWidget {
  const ConnectImapScreen({super.key});

  @override
  ConsumerState<ConnectImapScreen> createState() => _ConnectImapScreenState();
}

class _ConnectImapScreenState extends ConsumerState<ConnectImapScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _imapHost = TextEditingController();
  final _imapPort = TextEditingController(text: '993');
  final _smtpHost = TextEditingController();
  final _smtpPort = TextEditingController(text: '465');
  bool _imapSecure = true;
  bool _smtpSecure = true;

  @override
  void dispose() {
    for (final c in [_email, _password, _imapHost, _imapPort, _smtpHost, _smtpPort]) {
      c.dispose();
    }
    super.dispose();
  }

  ImapSettings get _settings => ImapSettings(
    email: _email.text.trim(),
    password: _password.text,
    imapHost: _imapHost.text.trim(),
    imapPort: int.parse(_imapPort.text.trim()),
    imapSecure: _imapSecure,
    smtpHost: _smtpHost.text.trim(),
    smtpPort: int.parse(_smtpPort.text.trim()),
    smtpSecure: _smtpSecure,
  );

  Future<void> _connect() async {
    if (!_form.currentState!.validate()) return;
    final service = ref.read(integrationsServiceProvider);
    try {
      final settings = _settings;
      if (!await service.verifyImap(settings)) {
        if (mounted) showMessage(context, "Couldn't sign in with those settings. Check them and try again.", error: true);
        return;
      }
      final result = await service.connectImap(settings);
      ref.invalidate(mailboxesProvider);
      ref.read(selectedMailboxIdProvider.notifier).select(result.mailboxId);
      if (!mounted) return;
      showMessage(context, '${result.email} has been connected');
      context.pop();
    } on Exception catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    }
  }

  static String? _required(String? v) => (v?.trim().isEmpty ?? true) ? 'Required' : null;

  static String? _port(String? v) {
    final n = int.tryParse(v?.trim() ?? '');
    return n == null || n < 1 || n > 65535 ? 'Enter a port (1–65535)' : null;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Connect custom email')),
    body: Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Use the IMAP and SMTP settings from your email provider. An app password is often required.'),
          const SizedBox(height: 16),
          TextFormField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            decoration: const InputDecoration(labelText: 'Email address'),
            validator: (v) =>
                RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(v?.trim() ?? '') ? null : 'Enter a valid email',
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: _password,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Password or app password'),
            validator: (v) => (v?.isEmpty ?? true) ? 'Required' : null,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                flex: 3,
                child: TextFormField(
                  controller: _imapHost,
                  autocorrect: false,
                  decoration: const InputDecoration(labelText: 'IMAP host', hintText: 'imap.example.com'),
                  validator: _required,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  controller: _imapPort,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Port'),
                  validator: _port,
                ),
              ),
            ],
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('IMAP uses SSL/TLS'),
            value: _imapSecure,
            onChanged: (v) => setState(() => _imapSecure = v),
          ),
          Row(
            children: [
              Expanded(
                flex: 3,
                child: TextFormField(
                  controller: _smtpHost,
                  autocorrect: false,
                  decoration: const InputDecoration(labelText: 'SMTP host', hintText: 'smtp.example.com'),
                  validator: _required,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  controller: _smtpPort,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Port'),
                  validator: _port,
                ),
              ),
            ],
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('SMTP uses SSL/TLS'),
            value: _smtpSecure,
            onChanged: (v) => setState(() => _smtpSecure = v),
          ),
          const SizedBox(height: 16),
          BusyButton(label: 'Connect', icon: Icons.link, onPressed: _connect),
        ],
      ),
    ),
  );
}
