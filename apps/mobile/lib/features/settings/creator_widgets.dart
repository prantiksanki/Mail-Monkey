import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/creator.dart';
import '../../shared/widgets/charts.dart';
import '../../shared/widgets/state_views.dart';
import 'settings_providers.dart';
import 'settings_widgets.dart';

/// Publishes/unpublishes the public page (creatorProfiles.update `enabled`).
class PageEnabledSwitch extends ConsumerWidget {
  const PageEnabledSwitch({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(creatorProfileProvider);
    return SwitchListTile(
      contentPadding: EdgeInsets.zero,
      title: const Text('Public page enabled'),
      value: profile.value?.enabled ?? false,
      onChanged: profile.hasValue
          ? (v) async {
              try {
                await ref.read(creatorServiceProvider).update(enabled: v);
                ref.invalidate(creatorProfileProvider);
              } on Exception catch (e) {
                if (context.mounted) showMessage(context, errorMessage(e), error: true);
              }
            }
          : null,
    );
  }
}

/// Settings → Media kit (web MediaKitForm).
class MediaKitSection extends ConsumerStatefulWidget {
  const MediaKitSection({super.key});

  @override
  ConsumerState<MediaKitSection> createState() => _MediaKitSectionState();
}

class _MediaKitSectionState extends ConsumerState<MediaKitSection> {
  bool? _enabled;
  List<LabeledValue>? _stats;
  List<LabeledValue>? _collabs;
  List<LabeledValue>? _rates;

  Future<void> _save() async {
    try {
      await ref.read(creatorServiceProvider).updateMediaKit(
        mediaKitEnabled: _enabled,
        stats: _stats!.where((s) => s.label.isNotEmpty && s.value.isNotEmpty).toList(),
        collaborations: _collabs!.where((c) => c.label.isNotEmpty).toList(),
        rateCard: _rates!.where((r) => r.label.isNotEmpty && r.value.isNotEmpty).toList(),
      );
      ref.invalidate(creatorProfileProvider);
      if (mounted) showMessage(context, 'Media kit saved');
    } on Exception catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(creatorProfileProvider);
    return SettingsSection(
      title: 'Media kit',
      description: 'Share audience stats, past collaborations and your rates on your public page.',
      child: profile.when(
        loading: () => const LinearProgressIndicator(),
        error: (e, _) => Text(errorMessage(e)),
        data: (p) {
          _enabled ??= p.mediaKitEnabled;
          _stats ??= [...p.stats];
          _collabs ??= [...p.collaborations];
          _rates ??= [...p.rateCard];
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Show media kit'),
                value: _enabled!,
                onChanged: (v) => setState(() => _enabled = v),
              ),
              PairListEditor(
                title: 'Stats',
                rows: _stats!,
                max: 6,
                hints: const ('Followers', '120K'),
                onChanged: (rows) => setState(() => _stats = rows),
              ),
              PairListEditor(
                title: 'Collaborations',
                rows: _collabs!,
                max: 20,
                hints: const ('Brand name', 'https://…'),
                onChanged: (rows) => setState(() => _collabs = rows),
              ),
              PairListEditor(
                title: 'Rate card',
                rows: _rates!,
                max: 10,
                hints: const ('Instagram post', r'$500'),
                onChanged: (rows) => setState(() => _rates = rows),
              ),
              const SizedBox(height: 8),
              Align(alignment: Alignment.centerRight, child: BusyButton(label: 'Save', onPressed: _save)),
            ],
          );
        },
      ),
    );
  }
}

/// Editable list of label/value rows.
class PairListEditor extends StatelessWidget {
  const PairListEditor({
    super.key,
    required this.title,
    required this.rows,
    required this.onChanged,
    required this.hints,
    this.max = 10,
  });

  final String title;
  final List<LabeledValue> rows;
  final ValueChanged<List<LabeledValue>> onChanged;
  final (String, String) hints;
  final int max;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 4),
        child: Text(title, style: Theme.of(context).textTheme.titleSmall),
      ),
      for (var i = 0; i < rows.length; i++)
        Padding(
          key: ObjectKey(rows[i]),
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(
            children: [
              Expanded(
                child: TextFormField(
                  initialValue: rows[i].label,
                  decoration: InputDecoration(hintText: hints.$1, isDense: true),
                  onChanged: (v) => rows[i] = LabeledValue(v.trim(), rows[i].value),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: TextFormField(
                  initialValue: rows[i].value,
                  decoration: InputDecoration(hintText: hints.$2, isDense: true),
                  onChanged: (v) => rows[i] = LabeledValue(rows[i].label, v.trim()),
                ),
              ),
              IconButton(
                tooltip: 'Remove',
                icon: const Icon(Icons.close),
                onPressed: () => onChanged([...rows]..removeAt(i)),
              ),
            ],
          ),
        ),
      if (rows.length < max)
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: () => onChanged([...rows, const LabeledValue('', '')]),
            icon: const Icon(Icons.add),
            label: const Text('Add'),
          ),
        ),
    ],
  );
}

/// Settings → Profile analytics (web ProfileAnalytics, last 30 days).
class ProfileAnalyticsSection extends ConsumerWidget {
  const ProfileAnalyticsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => SettingsSection(
    title: 'Page analytics',
    description: 'Last 30 days on your public page.',
    child: ref.watch(profileAnalyticsProvider(30)).when(
      loading: () => const LinearProgressIndicator(),
      error: (e, _) => Text(errorMessage(e)),
      data: (a) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          StatGrid(
            children: [
              StatTile(label: 'Views', value: '${a.views}'),
              StatTile(label: 'Contacts', value: '${a.contacts}'),
              StatTile(label: 'Bookings', value: '${a.bookings}'),
            ],
          ),
          if (a.daily.isNotEmpty) ...[
            const SizedBox(height: 12),
            BarChart(
              labels: [for (final d in a.daily) d.date.length >= 10 ? d.date.substring(5, 10) : d.date],
              primary: [for (final d in a.daily) d.count],
              primaryLabel: 'Views',
            ),
          ],
        ],
      ),
    ),
  );
}
