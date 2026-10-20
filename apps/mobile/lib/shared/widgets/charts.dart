import 'dart:math';

import 'package:flutter/material.dart';

/// Stat tile: big number, label, optional delta line.
class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.label, required this.value, this.caption, this.icon});

  final String label;
  final String value;
  final String? caption;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (icon != null) ...[Icon(icon, size: 18, color: theme.colorScheme.primary), const SizedBox(width: 6)],
                Expanded(child: Text(label, style: theme.textTheme.labelMedium, overflow: TextOverflow.ellipsis)),
              ],
            ),
            const SizedBox(height: 8),
            Text(value, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
            if (caption != null) ...[
              const SizedBox(height: 4),
              Text(caption!, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            ],
          ],
        ),
      ),
    );
  }
}

/// Two-column grid of stat tiles that wraps on narrow screens.
class StatGrid extends StatelessWidget {
  const StatGrid({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, c) {
      final columns = c.maxWidth > 600 ? 4 : 2;
      const gap = 12.0;
      final width = (c.maxWidth - gap * (columns - 1)) / columns;
      return Wrap(
        spacing: gap,
        runSpacing: gap,
        children: [for (final child in children) SizedBox(width: width, child: child)],
      );
    },
  );
}

/// Simple vertical bar chart (one or two series) with labels.
class BarChart extends StatelessWidget {
  const BarChart({
    super.key,
    required this.labels,
    required this.primary,
    this.secondary,
    this.primaryLabel,
    this.secondaryLabel,
    this.height = 160,
  });

  final List<String> labels;
  final List<int> primary;
  final List<int>? secondary;
  final String? primaryLabel;
  final String? secondaryLabel;
  final double height;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final maxValue = max(1, [...primary, ...?secondary].fold<int>(0, max));
    final step = max(1, (labels.length / 7).ceil());
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: height,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (var i = 0; i < primary.length; i++)
                Expanded(
                  child: Tooltip(
                    message: '${labels[i]}: ${primary[i]}${secondary != null ? ' / ${secondary![i]}' : ''}',
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 1.5),
                      child: Stack(
                        alignment: Alignment.bottomCenter,
                        children: [
                          FractionallySizedBox(
                            heightFactor: primary[i] / maxValue,
                            child: Container(
                              decoration: BoxDecoration(
                                color: scheme.primary.withValues(alpha: 0.35),
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
                              ),
                            ),
                          ),
                          if (secondary != null)
                            FractionallySizedBox(
                              heightFactor: secondary![i] / maxValue,
                              child: Container(
                                decoration: BoxDecoration(
                                  color: scheme.primary,
                                  borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            for (var i = 0; i < labels.length; i++)
              Expanded(
                child: Text(
                  i % step == 0 ? labels[i] : '',
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ),
          ],
        ),
        if (primaryLabel != null) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 16,
            children: [
              _Legend(color: scheme.primary.withValues(alpha: 0.35), label: primaryLabel!),
              if (secondaryLabel != null) _Legend(color: scheme.primary, label: secondaryLabel!),
            ],
          ),
        ],
      ],
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(width: 12, height: 12, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3))),
      const SizedBox(width: 6),
      Text(label, style: Theme.of(context).textTheme.labelSmall),
    ],
  );
}

/// Horizontal ranked bars (e.g. top senders, top rules).
class RankedBars extends StatelessWidget {
  const RankedBars({super.key, required this.items});

  final List<({String label, int value})> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const Text('No data yet');
    final top = items.map((e) => e.value).fold<int>(1, max);
    final scheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        for (final item in items)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(
              children: [
                Expanded(
                  flex: 5,
                  child: Text(item.label, maxLines: 1, overflow: TextOverflow.ellipsis),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 4,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: item.value / top,
                      minHeight: 8,
                      color: scheme.primary,
                      backgroundColor: scheme.surfaceContainerHighest,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(width: 40, child: Text('${item.value}', textAlign: TextAlign.end)),
              ],
            ),
          ),
      ],
    );
  }
}

/// Card with a title, used to group dashboard sections.
class SectionCard extends StatelessWidget {
  const SectionCard({super.key, required this.title, required this.child, this.trailing});

  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(title, style: Theme.of(context).textTheme.titleMedium)),
              ?trailing,
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    ),
  );
}
