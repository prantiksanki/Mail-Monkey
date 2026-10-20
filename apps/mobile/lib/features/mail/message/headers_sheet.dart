import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/json.dart';
import '../../../shared/utils/format.dart';
import '../../../shared/widgets/state_views.dart';
import '../mail_providers.dart';

/// "Show original" details: parsed headers plus SPF/DKIM/DMARC results
/// (`GET /mailboxes/{id}/inbox/{messageId}/headers`).
void showHeadersSheet(BuildContext context, {required String mailboxId, required String messageId}) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (_) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      builder: (context, scroll) => Consumer(
        builder: (context, ref, _) => FutureBuilder<JsonMap>(
          future: ref.read(mailServiceProvider).messageHeaders(mailboxId, messageId),
          builder: (context, snapshot) {
            if (snapshot.hasError) return ErrorView(error: snapshot.error!);
            if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
            final h = snapshot.data!;
            final security = asMap(h['security']);
            final auth = asMap(h['authentication']);
            final rows = <(String, String?)>[
              ('From', readStringOrNull(h, 'from')),
              ('To', readStringOrNull(h, 'to')),
              ('Cc', readStringOrNull(h, 'cc')),
              ('Reply-To', readStringOrNull(h, 'replyTo')),
              ('Subject', readStringOrNull(h, 'subject')),
              ('Date', formatFullDate(readDate(h, 'date'))),
              ('Mailed-by', readStringOrNull(h, 'mailedBy')),
              ('Signed-by', readStringOrNull(h, 'signedBy')),
              ('Security', readStringOrNull(security, 'label')),
              ('SPF', readStringOrNull(auth, 'spf')),
              ('DKIM', readStringOrNull(auth, 'dkim')),
              ('DMARC', readStringOrNull(auth, 'dmarc')),
            ];
            return ListView(
              controller: scroll,
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              children: [
                Text('Original message', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                for (final (label, value) in rows)
                  if (value != null && value.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 96,
                            child: Text(label, style: Theme.of(context).textTheme.labelLarge),
                          ),
                          Expanded(child: SelectableText(value)),
                        ],
                      ),
                    ),
              ],
            );
          },
        ),
      ),
    ),
  );
}
