import 'dart:convert';

import '../core/network/api_client.dart';
import '../models/json.dart';
import '../models/payment_card.dart';

/// Payment tracking (packages/api/modules/payment-tracking).
class BillsService {
  BillsService(this._api);

  final ApiClient _api;

  Future<({List<PaymentCard> cards, String? nextCursor})> list({
    String? mailboxId,
    String? paymentType,
    String? search,
    String? kanbanStatus,
    String? cursor,
    int limit = 100,
  }) async {
    final data = asMap(
      await _api.get(
        '/payment-tracking/cards',
        query: {
          'mailboxId': mailboxId,
          'paymentType': paymentType,
          'search': search,
          'kanbanStatus': kanbanStatus,
          'cursor': cursor,
          'limit': limit,
        },
      ),
    );
    return (
      cards: asMapList(data['cards']).map(PaymentCard.fromJson).toList(),
      nextCursor: readStringOrNull(data, 'nextCursor'),
    );
  }

  Future<PaymentCardDetail> get(String id) async =>
      PaymentCardDetail.fromJson(asMap(await _api.get('/payment-tracking/cards/${Uri.encodeComponent(id)}')));

  Future<void> updateStatus(String id, String kanbanStatus) => _api.patch(
    '/payment-tracking/cards/${Uri.encodeComponent(id)}/status',
    body: {'kanbanStatus': kanbanStatus},
  );

  Future<List<int>> attachment(String id, String attachmentId) async {
    final data = asMap(
      await _api.get(
        '/payment-tracking/cards/${Uri.encodeComponent(id)}/attachments/${Uri.encodeComponent(attachmentId)}',
      ),
    );
    // Gmail returns base64url; normalise before decoding.
    final raw = readString(data, 'base64Data').replaceAll('-', '+').replaceAll('_', '/');
    return base64Decode(base64.normalize(raw));
  }
}
