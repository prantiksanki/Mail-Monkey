import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import '../../core/routing/routes.dart';
import '../../models/payment_card.dart';
import '../../shared/utils/format.dart';
import '../../shared/widgets/state_views.dart';
import '../mail/mail_providers.dart';
import '../mail/message/email_body_view.dart';
import 'bills_providers.dart';

final _billProvider = FutureProvider.autoDispose.family<PaymentCardDetail, String>(
  (ref, id) => ref.watch(billsServiceProvider).get(id),
);

/// One payment email (web PaymentDetailDialog): details, attachments and
/// the original message.
class BillDetailScreen extends ConsumerStatefulWidget {
  const BillDetailScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<BillDetailScreen> createState() => _BillDetailScreenState();
}

class _BillDetailScreenState extends ConsumerState<BillDetailScreen> {
  final Set<String> _downloading = {};

  Future<void> _open(PaymentAttachment a) async {
    setState(() => _downloading.add(a.id));
    try {
      final bytes = await ref.read(billsServiceProvider).attachment(widget.id, a.id);
      final dir = await getTemporaryDirectory();
      final safeName = a.filename.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');
      final file = File('${dir.path}/${a.id.hashCode.toRadixString(16)}_$safeName');
      await file.writeAsBytes(bytes, flush: true);
      final result = await OpenFilex.open(file.path, type: a.mimeType);
      if (result.type != ResultType.done && mounted) {
        showMessage(context, 'No app can open ${a.filename}.', error: true);
      }
    } on Exception catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _downloading.remove(a.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(_billProvider(widget.id));
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(detail.value?.card.merchant.isNotEmpty ?? false ? detail.value!.card.merchant : 'Payment')),
      body: detail.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(_billProvider(widget.id))),
        data: (d) {
          final c = d.card;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Flexible(
                flex: 0,
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.45),
                  child: ListView(
                    shrinkWrap: true,
                    padding: const EdgeInsets.all(16),
                    children: [
                      Text(c.subject, style: theme.textTheme.titleMedium),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          if (c.amountLabel != null) Text(c.amountLabel!, style: theme.textTheme.headlineSmall),
                          if (c.merchant.isNotEmpty) Chip(label: Text(c.merchant), visualDensity: VisualDensity.compact),
                          Chip(
                            visualDensity: VisualDensity.compact,
                            label: Text(PaymentStatus.label(c.kanbanStatus)),
                            backgroundColor: c.kanbanStatus == PaymentStatus.overdue
                                ? theme.colorScheme.errorContainer
                                : theme.colorScheme.secondaryContainer,
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      // `from` is often already "Name <address>"; don't repeat it.
                      _Field(
                        'From',
                        c.from.contains('<') || c.from == c.fromEmail || c.fromEmail.isEmpty
                            ? c.from
                            : '${c.from} <${c.fromEmail}>',
                      ),
                      _Field('To', d.to),
                      _Field('Received', formatFullDate(c.receivedAt)),
                      if (c.dueDate != null) _Field('Due', formatFullDate(c.dueDate)),
                      _Field('Source', '${c.providerLabel} · ${c.mailboxEmail}'),
                      if (d.attachments.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text('Attachments (${d.attachments.length})', style: theme.textTheme.titleSmall),
                        for (final a in d.attachments)
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.attach_file),
                            title: Text(a.filename, overflow: TextOverflow.ellipsis),
                            subtitle: Text(formatBytes(a.size)),
                            trailing: _downloading.contains(a.id)
                                ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))
                                : IconButton(
                                    tooltip: 'Open',
                                    icon: const Icon(Icons.download_outlined),
                                    onPressed: () => _open(a),
                                  ),
                          ),
                      ],
                      const SizedBox(height: 8),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: FilledButton.tonalIcon(
                          onPressed: () => context.push(
                            Routes.messagePath(c.emailId),
                            extra: InboxQuery(mailboxId: c.mailboxId, folder: 'all'),
                          ),
                          icon: const Icon(Icons.mail_outline),
                          label: const Text('Go to email'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: d.bodyHtml.trim().isEmpty && d.bodyText.trim().isEmpty
                    ? const EmptyView(
                        icon: Icons.attach_file,
                        title: 'No readable content',
                        message: 'This email may contain only attachments.',
                      )
                    : EmailBodyView(bodyHtml: d.bodyHtml, bodyText: d.bodyText),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(text: '$label: ', style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
            TextSpan(text: value),
          ],
        ),
        style: theme.textTheme.bodySmall,
      ),
    );
  }
}
