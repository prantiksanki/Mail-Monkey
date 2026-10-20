import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';

import '../../core/providers.dart';
import '../../models/account.dart';
import '../../models/creator.dart';
import '../../services/account_service.dart';
import '../../services/creator_service.dart';
import '../../shared/widgets/state_views.dart';

final accountServiceProvider = Provider<AccountService>((ref) => AccountService(ref.watch(apiClientProvider)));

final integrationsServiceProvider = Provider<IntegrationsService>(
  (ref) => IntegrationsService(ref.watch(apiClientProvider)),
);

final billingServiceProvider = Provider<BillingService>((ref) => BillingService(ref.watch(apiClientProvider)));

final adminServiceProvider = Provider<AdminService>((ref) => AdminService(ref.watch(apiClientProvider)));

final creatorServiceProvider = Provider<CreatorService>(
  (ref) => CreatorService(ref.watch(apiClientProvider), ref.watch(accountServiceProvider)),
);

final sessionsProvider = FutureProvider.autoDispose<List<ActiveSession>>(
  (ref) => ref.watch(accountServiceProvider).listSessions(),
);

final linkedAccountsProvider = FutureProvider.autoDispose<List<LinkedAccount>>(
  (ref) => ref.watch(accountServiceProvider).listAccounts(),
);

final telegramStatusProvider = FutureProvider.autoDispose<TelegramStatus>(
  (ref) => ref.watch(integrationsServiceProvider).telegramStatus(),
);

final meetingProviderStatusProvider = FutureProvider.autoDispose.family<MeetingProviderStatus, String>(
  (ref, provider) => ref.watch(integrationsServiceProvider).meetingStatus(provider),
);

final purchasesProvider = FutureProvider.autoDispose<List<Purchase>>(
  (ref) => ref.watch(billingServiceProvider).purchases(),
);

final creatorProfileProvider = FutureProvider.autoDispose<CreatorProfile>(
  (ref) => ref.watch(creatorServiceProvider).me(),
);

final profileAnalyticsProvider = FutureProvider.autoDispose.family<ProfileAnalytics, int>(
  (ref, days) => ref.watch(creatorServiceProvider).analytics(rangeDays: days),
);

final bookingsProvider = FutureProvider.autoDispose<List<Booking>>(
  (ref) => ref.watch(creatorServiceProvider).bookings(),
);

/// Picks a photo from the gallery and returns it as a square PNG (the web
/// crops avatars to PNG before upload). Null if cancelled.
Future<Uint8List?> pickSquarePng(BuildContext context, {int size = 512, int maxBytes = 5 * 1024 * 1024}) async {
  final file = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2048, maxHeight: 2048);
  if (file == null) return null;
  final bytes = await file.readAsBytes();
  final decoded = img.decodeImage(bytes);
  if (decoded == null) {
    if (context.mounted) showMessage(context, "That file isn't a supported image.", error: true);
    return null;
  }
  final side = decoded.width < decoded.height ? decoded.width : decoded.height;
  final square = img.copyCrop(
    decoded,
    x: (decoded.width - side) ~/ 2,
    y: (decoded.height - side) ~/ 2,
    width: side,
    height: side,
  );
  final resized = side > size ? img.copyResize(square, width: size, height: size) : square;
  final png = Uint8List.fromList(img.encodePng(resized));
  if (png.length > maxBytes) {
    if (context.mounted) showMessage(context, 'Photo must be smaller than 5MB', error: true);
    return null;
  }
  return png;
}
