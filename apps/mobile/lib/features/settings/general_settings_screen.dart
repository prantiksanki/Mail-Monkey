import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config/env.dart';
import '../../core/routing/routes.dart';
import '../../models/session.dart';
import '../../shared/widgets/state_views.dart';
import '../auth/auth_controller.dart';
import 'creator_widgets.dart';
import 'settings_providers.dart';
import 'settings_widgets.dart';

const _accountTypes = {'STANDARD': 'Standard', 'FREELANCER': 'Freelancer', 'CREATOR': 'Creator'};

/// Settings → General (web: UserAvatarForm, ChangeNameForm, ChangeEmailForm,
/// CreatorModeForm, MediaKitForm, ProfileAnalytics). The language picker is
/// omitted, like the web, while only one locale exists.
class GeneralSettingsScreen extends ConsumerWidget {
  const GeneralSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).value?.user;
    return Scaffold(
      appBar: AppBar(title: const Text('General')),
      body: user == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _AvatarSection(user: user),
                _NameSection(user: user),
                _EmailSection(user: user),
                _CreatorModeSection(user: user),
                if (user.isCreator) ...[
                  const MediaKitSection(),
                  const ProfileAnalyticsSection(),
                ],
              ],
            ),
    );
  }
}

class _AvatarSection extends ConsumerStatefulWidget {
  const _AvatarSection({required this.user});

  final AppUser user;

  @override
  ConsumerState<_AvatarSection> createState() => _AvatarSectionState();
}

class _AvatarSectionState extends ConsumerState<_AvatarSection> {
  bool _uploading = false;

  Future<void> _pick() async {
    final png = await pickSquarePng(context);
    if (png == null || !mounted) return;
    setState(() => _uploading = true);
    try {
      await ref.read(accountServiceProvider).uploadAvatar(png);
      await ref.read(authControllerProvider.notifier).refresh();
      if (mounted) showMessage(context, 'Avatar updated');
    } on Exception catch (e) {
      if (mounted) showMessage(context, 'Could not update avatar: ${errorMessage(e)}', error: true);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final url = Env.imageUrl(widget.user.image);
    return SettingsSection(
      title: 'Avatar',
      description: 'Tap the image to choose a new photo.',
      child: Align(
        alignment: Alignment.centerLeft,
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: _uploading ? null : _pick,
          child: Stack(
            alignment: Alignment.center,
            children: [
              CircleAvatar(
                radius: 40,
                backgroundImage: url == null ? null : NetworkImage(url),
                child: url == null ? Text(widget.user.initials, style: const TextStyle(fontSize: 24)) : null,
              ),
              if (_uploading) const CircularProgressIndicator(),
            ],
          ),
        ),
      ),
    );
  }
}

class _NameSection extends ConsumerStatefulWidget {
  const _NameSection({required this.user});

  final AppUser user;

  @override
  ConsumerState<_NameSection> createState() => _NameSectionState();
}

class _NameSectionState extends ConsumerState<_NameSection> {
  late final _name = TextEditingController(text: widget.user.name);
  final _form = GlobalKey<FormState>();

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    try {
      await ref.read(accountServiceProvider).updateUser({'name': _name.text.trim()});
      await ref.read(authControllerProvider.notifier).refresh();
      if (mounted) showMessage(context, 'Name updated');
    } on Exception catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) => SettingsSection(
    title: 'Name',
    child: Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          TextFormField(
            controller: _name,
            textCapitalization: TextCapitalization.words,
            validator: (v) => (v?.trim().length ?? 0) < 3 ? 'Name must be at least 3 characters' : null,
          ),
          const SizedBox(height: 12),
          BusyButton(label: 'Save', onPressed: _save),
        ],
      ),
    ),
  );
}

class _EmailSection extends ConsumerStatefulWidget {
  const _EmailSection({required this.user});

  final AppUser user;

  @override
  ConsumerState<_EmailSection> createState() => _EmailSectionState();
}

class _EmailSectionState extends ConsumerState<_EmailSection> {
  late final _email = TextEditingController(text: widget.user.email);
  final _form = GlobalKey<FormState>();

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    final next = _email.text.trim();
    if (next.toLowerCase() == widget.user.email.toLowerCase()) return;
    try {
      await ref.read(accountServiceProvider).changeEmail(next);
      if (mounted) showMessage(context, 'Check your inbox to confirm the new email address.');
    } on Exception {
      if (mounted) showMessage(context, 'Could not update email', error: true);
    }
  }

  @override
  Widget build(BuildContext context) => SettingsSection(
    title: 'Email',
    description: 'A confirmation link is sent before the change takes effect.',
    child: Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          TextFormField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            validator: (v) => RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(v?.trim() ?? '') ? null : 'Enter a valid email',
          ),
          const SizedBox(height: 12),
          BusyButton(label: 'Save', onPressed: _save),
        ],
      ),
    ),
  );
}

class _CreatorModeSection extends ConsumerStatefulWidget {
  const _CreatorModeSection({required this.user});

  final AppUser user;

  @override
  ConsumerState<_CreatorModeSection> createState() => _CreatorModeSectionState();
}

class _CreatorModeSectionState extends ConsumerState<_CreatorModeSection> {
  bool _saving = false;

  Future<void> _setType(String type) async {
    setState(() => _saving = true);
    try {
      await ref.read(accountServiceProvider).updateUser({'accountType': type});
      await ref.read(authControllerProvider.notifier).refresh();
      ref.invalidate(creatorProfileProvider);
      if (mounted) showMessage(context, 'Account type updated');
    } on Exception {
      if (mounted) showMessage(context, 'Could not update account type', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => SettingsSection(
    title: 'Creator mode',
    description: 'Freelancers and creators get a public page with links, booking and a media kit.',
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<String>(
          initialValue: _accountTypes.containsKey(widget.user.accountType) ? widget.user.accountType : 'STANDARD',
          items: [for (final e in _accountTypes.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
          onChanged: _saving ? null : (v) => v == null ? null : _setType(v),
        ),
        if (widget.user.isCreator) ...[
          const SizedBox(height: 8),
          const PageEnabledSwitch(),
          TextButton.icon(
            onPressed: () => context.push(Routes.myPage),
            icon: const Icon(Icons.edit_outlined),
            label: const Text('Edit My Page'),
          ),
        ],
      ],
    ),
  );
}
