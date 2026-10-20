import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_timezone/flutter_timezone.dart';

import '../../core/providers.dart';
import '../../services/ai_service.dart';

final aiServiceProvider = Provider<AiService>((ref) => AiService(ref.watch(apiClientProvider)));

final conversationsProvider = FutureProvider.family<List<AiConversation>, String>(
  (ref, mailboxId) => ref.watch(aiServiceProvider).listConversations(mailboxId),
);

/// The device's IANA time zone (e.g. `Asia/Kolkata`), sent to the inbox
/// assistant so "today"/"this week" resolve like the web's
/// `Intl.DateTimeFormat().resolvedOptions().timeZone`.
final deviceTimeZoneProvider = FutureProvider<String?>((ref) async {
  try {
    return (await FlutterTimezone.getLocalTimezone()).identifier;
  } on Exception {
    return null;
  }
});
