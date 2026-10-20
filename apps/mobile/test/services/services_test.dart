import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mail_monkey/core/config/env.dart';
import 'package:mail_monkey/core/network/api_client.dart';
import 'package:mail_monkey/core/security/token_store.dart';
import 'package:mail_monkey/models/creator.dart';
import 'package:mail_monkey/models/payment_card.dart';
import 'package:mail_monkey/services/account_service.dart';
import 'package:mail_monkey/services/bills_service.dart';
import 'package:mail_monkey/services/creator_service.dart';

import '../support/fake_http.dart';

void main() {
  ApiClient apiWith(FakeAdapter adapter) => ApiClient(tokenStore: MemoryTokenStore('tok.sig'), dio: fakeDio(adapter));

  test('avatar upload never sends the session token to the storage URL', () async {
    final api = FakeAdapter((r) {
      if (r.path == '/users/avatar-upload-url') {
        return const FakeResponse(200, {'signedUploadUrl': 'https://bucket.example/u1.png?sig=x', 'path': 'u1.png'});
      }
      return const FakeResponse(200, {'status': true});
    });
    final storage = FakeAdapter((_) => const FakeResponse(200));
    final service = AccountService(apiWith(api), uploader: Dio()..httpClientAdapter = storage);

    final path = await service.uploadAvatar(Uint8List.fromList([1, 2, 3]));

    final put = storage.requests.single;
    expect(put.method, 'PUT');
    expect(put.options.uri.toString(), 'https://bucket.example/u1.png?sig=x');
    expect(put.authorization, isNull);
    expect(put.options.headers['x-ms-blob-type'], 'BlockBlob');
    expect(put.options.headers[Headers.contentTypeHeader], 'image/png');

    final update = api.requests.last;
    expect(update.path, '/auth/update-user');
    expect((update.body! as Map)['image'], startsWith('u1.png?v='));
    expect(path, startsWith('u1.png?v='));
  });

  test('bill attachments decode base64 and base64url data', () async {
    final bytes = [251, 255, 191, 0, 10];
    final adapter = FakeAdapter((_) => FakeResponse(200, {'base64Data': base64Url.encode(bytes).replaceAll('=', '')}));
    final service = BillsService(apiWith(adapter));

    expect(await service.attachment('card 1', 'att/1'), bytes);
    expect(adapter.requests.single.path, '/payment-tracking/cards/card%201/attachments/att%2F1');
  });

  test('bill list parses cards and formats amounts', () async {
    final adapter = FakeAdapter(
      (_) => const FakeResponse(200, {
        'cards': [
          {
            'id': 'c1',
            'merchant': 'Netflix',
            'amount': 15.49,
            'currency': 'USD',
            'kanbanStatus': 'OVERDUE',
            'paymentType': 'subscription',
            'dueDate': '2026-10-01T00:00:00.000Z',
          },
        ],
        'nextCursor': 'n2',
      }),
    );
    final page = await BillsService(apiWith(adapter)).list(paymentType: 'subscription');

    expect(adapter.requests.single.query, {'paymentType': 'subscription', 'limit': 100});
    expect(page.nextCursor, 'n2');
    final card = page.cards.single;
    expect(card.kanbanStatus, PaymentStatus.overdue);
    expect(card.amountLabel, r'$15.49');
    expect(card.withStatus(PaymentStatus.paid).statusSource, 'MANUAL');
  });

  test('creator profile links and availability round-trip to the API shape', () async {
    final adapter = FakeAdapter((_) => const FakeResponse(200));
    final service = CreatorService(apiWith(adapter), AccountService(apiWith(adapter)));

    await service.update(
      links: const [
        ProfileLink(label: 'Site', url: 'https://a.dev', platform: 'website'),
        ProfileLink(label: 'Contact me', type: 'contact-form', url: 'ignored'),
      ],
    );
    await service.updateBookingSettings(
      availability: const [AvailabilityWindow(dayOfWeek: 1, startTime: '09:00', endTime: '17:00')],
    );

    final links = (adapter.requests.first.body! as Map)['links'] as List;
    expect(links.first, {
      'label': 'Site',
      'url': 'https://a.dev',
      'type': 'url',
      'platform': 'website',
      'featured': false,
      'enabled': true,
    });
    expect((links.last as Map).containsKey('url'), isFalse);
    expect(adapter.requests.last.body, {
      'availability': [
        {'dayOfWeek': 1, 'startTime': '09:00', 'endTime': '17:00'},
      ],
    });
  });

  test('image paths resolve through the web image proxy', () {
    expect(Env.imageUrl(null), isNull);
    expect(Env.imageUrl('https://lh3.googleusercontent.com/a'), 'https://lh3.googleusercontent.com/a');
    expect(Env.imageUrl('u1.png?v=1'), '${Env.apiBaseUrl}/image-proxy/avatars/u1.png?v=1');
  });
}
