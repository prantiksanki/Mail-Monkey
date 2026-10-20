import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/env.dart';
import '../../models/creator.dart';
import '../../models/json.dart';
import '../../shared/widgets/app_drawer.dart';
import '../../shared/widgets/state_views.dart';
import '../auth/auth_controller.dart';
import '../settings/settings_providers.dart';

const _days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const _fonts = {'inter': 'Inter', 'serif': 'Georgia', 'rounded': 'Rounded', 'mono': 'Mono'};
const _buttonStyles = {'fill': 'Fill', 'outline': 'Outline', 'soft': 'Soft'};
const _wallpapers = {'fill': 'Fill', 'gradient': 'Gradient', 'blur': 'Blur', 'pattern': 'Pattern', 'background': 'Background'};
const _patterns = {'noise': 'Noise', 'grid': 'Grid', 'blob': 'Blob', 'dots': 'Dots'};
const _backgrounds = [
  'sunset', 'ocean', 'forest', 'candy', 'midnight', 'peach', 'prism', 'lava', 'plasma', 'pulse', 'vortex', //
  'mist', 'stars', 'particles', 'sunsetGlow', 'oceanicDepth', 'forestCanopy', 'cosmicNebula', 'desertDawn',
  'fieryEmbers', 'lavenderDreams', 'arcticHaze', 'retroWave', 'violetGlow', 'elegantDark', 'livingOrigami',
  'paperShader', 'softGlow',
];
final _hex = RegExp(r'^#[0-9a-fA-F]{6}$');

/// Editable copy of one day's availability (null = unavailable).
class _DayWindow {
  _DayWindow(this.start, this.end);

  String start;
  String end;
}

/// Creator "My Page" editor (web MyPageEditor): profile, links, booking
/// availability and design, saved together like the web.
class MyPageScreen extends ConsumerWidget {
  const MyPageScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(creatorProfileProvider);
    return profile.when(
      loading: () => Scaffold(appBar: AppBar(title: const Text('My Page')), body: const Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(
        appBar: AppBar(title: const Text('My Page')),
        body: ErrorView(error: e, onRetry: () => ref.invalidate(creatorProfileProvider)),
      ),
      data: (p) => _Editor(profile: p),
    );
  }
}

class _Editor extends ConsumerStatefulWidget {
  const _Editor({required this.profile});

  final CreatorProfile profile;

  @override
  ConsumerState<_Editor> createState() => _EditorState();
}

class _EditorState extends ConsumerState<_Editor> {
  late bool _enabled = widget.profile.enabled;
  late final _displayName = TextEditingController(text: widget.profile.displayName ?? '');
  late final _bio = TextEditingController(text: widget.profile.bio);
  late String? _avatarUrl = widget.profile.avatarUrl;
  late final _username = TextEditingController(text: ref.read(authControllerProvider).value?.user.username ?? '');
  late List<ProfileLink> _links = [...widget.profile.links];
  late bool _bookingEnabled = widget.profile.bookingEnabled;
  late final List<_DayWindow?> _week = _loadWeek(widget.profile.availability);
  late final _accent = TextEditingController(text: widget.profile.accentColor);
  late String _layout = widget.profile.layout;
  late final JsonMap _design = {...widget.profile.design};
  bool _saving = false;
  bool _uploading = false;

  static List<_DayWindow?> _loadWeek(List<AvailabilityWindow> windows) {
    final week = List<_DayWindow?>.filled(7, null);
    for (final w in windows) {
      // API: 0 = Sunday … 6 = Saturday; editor rows run Mon..Sun.
      week[(w.dayOfWeek + 6) % 7] = _DayWindow(w.startTime, w.endTime);
    }
    return week;
  }

  @override
  void dispose() {
    _displayName.dispose();
    _bio.dispose();
    _username.dispose();
    _accent.dispose();
    super.dispose();
  }

  String get _pageUrl => '${Env.apiBaseUrl}/u/${_username.text.trim()}';

  Future<void> _saveUsername() async {
    final next = _username.text.trim();
    if (next.isEmpty || next == ref.read(authControllerProvider).value?.user.username) return;
    try {
      await ref.read(accountServiceProvider).updateUser({'username': next});
      await ref.read(authControllerProvider.notifier).refresh();
      if (mounted) showMessage(context, 'Username saved');
    } on Exception catch (e) {
      if (mounted) showMessage(context, "Couldn't save that username: ${errorMessage(e)}", error: true);
    }
  }

  Future<void> _pickPhoto() async {
    final png = await pickSquarePng(context);
    if (png == null || !mounted) return;
    setState(() => _uploading = true);
    try {
      final path = await ref.read(creatorServiceProvider).uploadPhoto(png);
      setState(() => _avatarUrl = path);
      if (mounted) showMessage(context, 'Photo uploaded — tap Save to publish');
    } on Exception {
      if (mounted) showMessage(context, "Couldn't upload photo", error: true);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  static String _normalizeUrl(String url) {
    final t = url.trim();
    if (t.isEmpty) return '';
    return RegExp('^https?://', caseSensitive: false).hasMatch(t) ? t : 'https://$t';
  }

  Future<void> _save() async {
    if (!_hex.hasMatch(_accent.text.trim())) {
      showMessage(context, 'Use a hex color like #6E3BFF', error: true);
      return;
    }
    for (final key in ['backgroundColor', 'textColor']) {
      final v = _design[key];
      if (v is String && v.isNotEmpty && !_hex.hasMatch(v)) {
        showMessage(context, 'Use hex colors like #FFFFFF', error: true);
        return;
      }
    }
    // Skip rows with no label or (for URL links) no URL, like the web.
    final links = [
      for (final l in _links)
        if (l.label.trim().isNotEmpty && (l.isContactForm || (l.url?.trim().isNotEmpty ?? false)))
          l.copyWith(label: l.label.trim(), url: l.isContactForm ? null : _normalizeUrl(l.url!)),
    ];
    final availability = [
      for (var i = 0; i < 7; i++)
        if (_week[i] != null)
          AvailabilityWindow(dayOfWeek: (i + 1) % 7, startTime: _week[i]!.start, endTime: _week[i]!.end),
    ];
    setState(() => _saving = true);
    final service = ref.read(creatorServiceProvider);
    try {
      await Future.wait([
        service.update(
          displayName: _displayName.text.trim(),
          avatarUrl: _avatarUrl,
          bio: _bio.text,
          enabled: _enabled,
          links: links,
        ),
        service.updateBookingSettings(bookingEnabled: _bookingEnabled, availability: availability),
        service.updateBranding(accentColor: _accent.text.trim(), layout: _layout, design: _design),
      ]);
      ref.invalidate(creatorProfileProvider);
      if (mounted) showMessage(context, 'My Page saved');
    } on Exception catch (e) {
      if (mounted) showMessage(context, "Couldn't save My Page: ${errorMessage(e)}", error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasUsername = ref.watch(authControllerProvider).value?.user.username?.isNotEmpty ?? false;
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        drawer: const AppDrawer(selected: 'my-page'),
        appBar: AppBar(
          title: const Text('My Page'),
          actions: [
            if (hasUsername) ...[
              IconButton(
                tooltip: 'Copy link',
                icon: const Icon(Icons.link),
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: _pageUrl));
                  if (context.mounted) showMessage(context, 'Link copied');
                },
              ),
              IconButton(
                tooltip: 'View live',
                icon: const Icon(Icons.open_in_new),
                onPressed: () => launchUrl(Uri.parse(_pageUrl), mode: LaunchMode.externalApplication),
              ),
            ],
            TextButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'Saving…' : 'Save')),
          ],
          bottom: const TabBar(
            tabs: [Tab(text: 'Profile'), Tab(text: 'Links'), Tab(text: 'Booking'), Tab(text: 'Design')],
          ),
        ),
        body: TabBarView(children: [_profileTab(), _linksTab(), _bookingTab(), _designTab()]),
      ),
    );
  }

  Widget _profileTab() {
    final photo = Env.imageUrl(_avatarUrl);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Page published'),
          value: _enabled,
          onChanged: (v) => setState(() => _enabled = v),
        ),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _username,
                autocorrect: false,
                decoration: const InputDecoration(labelText: 'Username', prefixText: '/u/'),
              ),
            ),
            TextButton(onPressed: _saveUsername, child: const Text('Save')),
          ],
        ),
        if (_username.text.trim().isEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 4),
            child: Text('Set a username to get your public page and booking link.'),
          ),
        const SizedBox(height: 16),
        Row(
          children: [
            CircleAvatar(
              radius: 32,
              backgroundImage: photo == null ? null : NetworkImage(photo),
              child: photo == null ? const Icon(Icons.person) : null,
            ),
            const SizedBox(width: 12),
            OutlinedButton.icon(
              onPressed: _uploading ? null : _pickPhoto,
              icon: _uploading
                  ? const SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.photo_outlined),
              label: const Text('Change photo'),
            ),
            if (_avatarUrl != null)
              IconButton(
                tooltip: 'Remove photo',
                icon: const Icon(Icons.close),
                onPressed: () => setState(() => _avatarUrl = null),
              ),
          ],
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _displayName,
          maxLength: 120,
          decoration: const InputDecoration(labelText: 'Display name', hintText: 'Defaults to your account name'),
        ),
        TextField(
          controller: _bio,
          maxLength: 500,
          minLines: 3,
          maxLines: 6,
          decoration: const InputDecoration(labelText: 'Bio', alignLabelWithHint: true),
        ),
        const Divider(height: 32),
        const _DirectoryAndPaidBooking(),
      ],
    );
  }

  Widget _linksTab() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      for (var i = 0; i < _links.length; i++)
        _LinkEditor(
          key: ObjectKey(_links[i]),
          link: _links[i],
          onChanged: (l) => _links[i] = l,
          onRemove: () => setState(() => _links = [..._links]..removeAt(i)),
          onMove: (delta) {
            final j = i + delta;
            if (j < 0 || j >= _links.length) return;
            setState(() {
              final next = [..._links];
              final item = next.removeAt(i);
              next.insert(j, item);
              _links = next;
            });
          },
        ),
      if (_links.length < 10)
        Wrap(
          spacing: 8,
          children: [
            OutlinedButton.icon(
              onPressed: () => setState(() => _links = [..._links, const ProfileLink(label: '', url: '', platform: 'website')]),
              icon: const Icon(Icons.add_link),
              label: const Text('Add link'),
            ),
            if (!_links.any((l) => l.isContactForm))
              OutlinedButton.icon(
                onPressed: () => setState(
                  () => _links = [..._links, const ProfileLink(label: 'Contact me', type: 'contact-form')],
                ),
                icon: const Icon(Icons.mail_outline),
                label: const Text('Add contact form'),
              ),
          ],
        ),
    ],
  );

  Widget _bookingTab() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      SwitchListTile(
        contentPadding: EdgeInsets.zero,
        title: const Text('Accept bookings'),
        subtitle: Text(
          'Visitors can request ${widget.profile.meetingLengthMinutes}-minute meetings '
          '(${widget.profile.bookingTimezone}).',
        ),
        value: _bookingEnabled,
        onChanged: (v) => setState(() => _bookingEnabled = v),
      ),
      const SizedBox(height: 8),
      for (var i = 0; i < 7; i++)
        Row(
          children: [
            SizedBox(width: 48, child: Text(_days[i])),
            Switch(
              value: _week[i] != null,
              onChanged: (v) => setState(() => _week[i] = v ? _DayWindow('09:00', '17:00') : null),
            ),
            const SizedBox(width: 8),
            if (_week[i] != null) ...[
              _TimeButton(value: _week[i]!.start, onChanged: (t) => setState(() => _week[i]!.start = t)),
              const Text(' – '),
              _TimeButton(value: _week[i]!.end, onChanged: (t) => setState(() => _week[i]!.end = t)),
            ] else
              const Text('Unavailable'),
          ],
        ),
    ],
  );

  Widget _designTab() {
    String pick(String key, String fallback) => (_design[key] as String?) ?? fallback;
    Widget dropdown(String label, String key, Map<String, String> options, String fallback) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DropdownButtonFormField<String>(
        initialValue: options.containsKey(pick(key, fallback)) ? pick(key, fallback) : fallback,
        decoration: InputDecoration(labelText: label),
        items: [for (final e in options.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
        onChanged: (v) => setState(() => _design[key] = v),
      ),
    );
    Widget colorField(String label, String key) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        initialValue: _design[key] as String? ?? '',
        decoration: InputDecoration(labelText: label, hintText: '#FFFFFF'),
        onChanged: (v) => v.trim().isEmpty ? _design.remove(key) : _design[key] = v.trim(),
      ),
    );
    final wallpaper = pick('wallpaperStyle', 'fill');
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          controller: _accent,
          decoration: InputDecoration(
            labelText: 'Accent color',
            hintText: '#6E3BFF',
            suffixIcon: Padding(
              padding: const EdgeInsets.all(12),
              child: CircleAvatar(radius: 10, backgroundColor: _parseColor(_accent.text)),
            ),
          ),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _layout == 'COMPACT' ? 'COMPACT' : 'STANDARD',
          decoration: const InputDecoration(labelText: 'Layout'),
          items: const [
            DropdownMenuItem(value: 'STANDARD', child: Text('Standard')),
            DropdownMenuItem(value: 'COMPACT', child: Text('Compact')),
          ],
          onChanged: (v) => setState(() => _layout = v ?? _layout),
        ),
        const SizedBox(height: 12),
        dropdown('Button style', 'buttonStyle', _buttonStyles, 'fill'),
        dropdown('Font', 'font', _fonts, 'inter'),
        colorField('Background color', 'backgroundColor'),
        colorField('Text color', 'textColor'),
        dropdown('Wallpaper', 'wallpaperStyle', _wallpapers, 'fill'),
        if (wallpaper == 'pattern') dropdown('Pattern', 'patternType', _patterns, 'noise'),
        if (wallpaper == 'background')
          dropdown('Background', 'backgroundType', {for (final b in _backgrounds) b: b}, 'sunset'),
        if (wallpaper != 'fill') ...[
          const Text('Wallpaper opacity'),
          Slider(
            value: ((_design['wallpaperOpacity'] as num?) ?? 1).toDouble().clamp(0, 1),
            onChanged: (v) => setState(() => _design['wallpaperOpacity'] = double.parse(v.toStringAsFixed(2))),
          ),
        ],
      ],
    );
  }

  static Color? _parseColor(String hex) =>
      _hex.hasMatch(hex.trim()) ? Color(int.parse('FF${hex.trim().substring(1)}', radix: 16)) : null;
}

class _LinkEditor extends StatelessWidget {
  const _LinkEditor({super.key, required this.link, required this.onChanged, required this.onRemove, required this.onMove});

  final ProfileLink link;
  final ValueChanged<ProfileLink> onChanged;
  final VoidCallback onRemove;
  final ValueChanged<int> onMove;

  @override
  Widget build(BuildContext context) {
    var current = link;
    void update(ProfileLink next) {
      current = next;
      onChanged(next);
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 4, 4, 12),
        child: StatefulBuilder(
          builder: (context, setLocal) => Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      current.isContactForm ? 'Contact form' : 'Link',
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                  ),
                  IconButton(tooltip: 'Move up', icon: const Icon(Icons.arrow_upward), onPressed: () => onMove(-1)),
                  IconButton(tooltip: 'Move down', icon: const Icon(Icons.arrow_downward), onPressed: () => onMove(1)),
                  IconButton(tooltip: 'Remove', icon: const Icon(Icons.delete_outline), onPressed: onRemove),
                ],
              ),
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Column(
                  children: [
                    TextFormField(
                      initialValue: current.label,
                      maxLength: 40,
                      decoration: const InputDecoration(labelText: 'Label', isDense: true),
                      onChanged: (v) => update(current.copyWith(label: v)),
                    ),
                    if (!current.isContactForm) ...[
                      TextFormField(
                        initialValue: current.url,
                        keyboardType: TextInputType.url,
                        autocorrect: false,
                        decoration: const InputDecoration(labelText: 'URL', isDense: true),
                        onChanged: (v) => update(current.copyWith(url: v)),
                      ),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        initialValue: linkPlatforms.contains(current.platform) ? current.platform : 'website',
                        decoration: const InputDecoration(labelText: 'Platform', isDense: true),
                        items: [
                          for (final p in linkPlatforms)
                            DropdownMenuItem(value: p, child: Text(p == 'x' ? 'X' : p[0].toUpperCase() + p.substring(1))),
                        ],
                        onChanged: (v) => update(current.copyWith(platform: v)),
                      ),
                    ],
                  ],
                ),
              ),
              Row(
                children: [
                  Expanded(
                    child: CheckboxListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Featured'),
                      value: current.featured,
                      onChanged: (v) => setLocal(() => update(current.copyWith(featured: v ?? false))),
                    ),
                  ),
                  Expanded(
                    child: CheckboxListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Visible'),
                      value: current.enabled,
                      onChanged: (v) => setLocal(() => update(current.copyWith(enabled: v ?? true))),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TimeButton extends StatelessWidget {
  const _TimeButton({required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => OutlinedButton(
    style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact),
    onPressed: () async {
      final parts = value.split(':');
      final picked = await showTimePicker(
        context: context,
        initialTime: TimeOfDay(hour: int.tryParse(parts[0]) ?? 9, minute: int.tryParse(parts.last) ?? 0),
      );
      if (picked != null) {
        onChanged('${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}');
      }
    },
    child: Text(value),
  );
}

/// Directory listing and paid booking (API-only settings, saved immediately).
class _DirectoryAndPaidBooking extends ConsumerStatefulWidget {
  const _DirectoryAndPaidBooking();

  @override
  ConsumerState<_DirectoryAndPaidBooking> createState() => _DirectoryAndPaidBookingState();
}

class _DirectoryAndPaidBookingState extends ConsumerState<_DirectoryAndPaidBooking> {
  final _tag = TextEditingController();

  @override
  void dispose() {
    _tag.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    try {
      await action();
      ref.invalidate(creatorProfileProvider);
    } on Exception catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = ref.watch(creatorProfileProvider).value;
    if (p == null) return const SizedBox.shrink();
    final service = ref.read(creatorServiceProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('List me in the creator directory'),
          value: p.directoryListed,
          onChanged: (v) => _run(() => service.updateDirectorySettings(directoryListed: v)),
        ),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (final t in p.tags)
              InputChip(
                label: Text(t),
                onDeleted: () => _run(() => service.updateDirectorySettings(tags: [...p.tags]..remove(t))),
              ),
          ],
        ),
        if (p.tags.length < 8)
          TextField(
            controller: _tag,
            autocorrect: false,
            decoration: const InputDecoration(labelText: 'Add tag', hintText: 'lowercase-with-hyphens'),
            onSubmitted: (v) {
              final tag = v.trim().toLowerCase();
              if (!RegExp(r'^[a-z0-9-]{2,24}$').hasMatch(tag)) {
                showMessage(context, 'Tags are 2–24 lowercase letters, numbers or hyphens', error: true);
                return;
              }
              _tag.clear();
              unawaited(_run(() => service.updateDirectorySettings(tags: {...p.tags, tag}.toList())));
            },
          ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Paid bookings'),
          subtitle: const Text('Visitors pay a fixed platform fee to book you.'),
          value: p.paidBookingEnabled,
          onChanged: (v) => _run(() => service.updatePaidBooking(enabled: v)),
        ),
      ],
    );
  }
}
