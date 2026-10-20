import 'package:flutter/material.dart';

/// A titled settings block (web SettingsItem).
class SettingsSection extends StatelessWidget {
  const SettingsSection({super.key, required this.title, this.description, required this.child, this.danger = false});

  final String title;
  final String? description;
  final Widget child;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: danger
          ? RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: theme.colorScheme.error.withValues(alpha: 0.5)),
            )
          : null,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: theme.textTheme.titleMedium),
            if (description != null) ...[
              const SizedBox(height: 4),
              Text(
                description!,
                style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
            ],
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

/// A small inline notice for things the mobile app can't do yet.
class BlockedNotice extends StatelessWidget {
  const BlockedNotice(this.message, {super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline, size: 18, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: 8),
          Expanded(child: Text(message, style: theme.textTheme.bodySmall)),
        ],
      ),
    );
  }
}

/// Button that shows a spinner while [onPressed] runs.
class BusyButton extends StatefulWidget {
  const BusyButton({super.key, required this.label, required this.onPressed, this.tonal = false, this.icon});

  final String label;
  final Future<void> Function()? onPressed;
  final bool tonal;
  final IconData? icon;

  @override
  State<BusyButton> createState() => _BusyButtonState();
}

class _BusyButtonState extends State<BusyButton> {
  bool _busy = false;

  Future<void> _run() async {
    setState(() => _busy = true);
    try {
      await widget.onPressed!();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final onPressed = widget.onPressed == null || _busy ? null : _run;
    final child = _busy
        ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
        : Text(widget.label);
    final icon = widget.icon == null || _busy ? null : Icon(widget.icon);
    if (widget.tonal) {
      return icon == null
          ? FilledButton.tonal(onPressed: onPressed, child: child)
          : FilledButton.tonalIcon(onPressed: onPressed, icon: icon, label: child);
    }
    return icon == null
        ? FilledButton(onPressed: onPressed, child: child)
        : FilledButton.icon(onPressed: onPressed, icon: icon, label: child);
  }
}
