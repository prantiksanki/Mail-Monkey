import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/widgets/state_views.dart';
import 'settings_providers.dart';
import 'settings_widgets.dart';

/// Change password (web ChangePasswordForm): used in Security settings and
/// the forced first-login change.
class ChangePasswordForm extends ConsumerStatefulWidget {
  const ChangePasswordForm({super.key, this.onChanged});

  final VoidCallback? onChanged;

  @override
  ConsumerState<ChangePasswordForm> createState() => _ChangePasswordFormState();
}

class _ChangePasswordFormState extends ConsumerState<ChangePasswordForm> {
  final _form = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  bool _revokeOthers = true;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    try {
      await ref.read(accountServiceProvider).changePassword(
        currentPassword: _current.text,
        newPassword: _next.text,
        revokeOtherSessions: _revokeOthers,
      );
      _current.clear();
      _next.clear();
      if (mounted) showMessage(context, 'Password updated');
      widget.onChanged?.call();
    } on Exception catch (e) {
      if (mounted) showMessage(context, 'Could not update password: ${errorMessage(e)}', error: true);
    }
  }

  @override
  Widget build(BuildContext context) => Form(
    key: _form,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextFormField(
          controller: _current,
          obscureText: true,
          autofillHints: const [AutofillHints.password],
          decoration: const InputDecoration(labelText: 'Current password'),
          validator: (v) => (v?.isEmpty ?? true) ? 'Required' : null,
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: _next,
          obscureText: true,
          autofillHints: const [AutofillHints.newPassword],
          decoration: const InputDecoration(labelText: 'New password'),
          validator: (v) => (v?.length ?? 0) < 8 ? 'Use at least 8 characters' : null,
        ),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Sign out other sessions'),
          value: _revokeOthers,
          onChanged: (v) => setState(() => _revokeOthers = v ?? true),
        ),
        Align(alignment: Alignment.centerRight, child: BusyButton(label: 'Save', onPressed: _submit)),
      ],
    ),
  );
}
