import 'dart:typed_data';

import '../core/network/api_client.dart';
import '../models/creator.dart';
import '../models/json.dart';
import 'account_service.dart';

/// Creator mode: My Page, media kit, directory, bookings
/// (packages/api/modules/creator-profiles).
class CreatorService {
  CreatorService(this._api, this._account);

  final ApiClient _api;

  /// For the signed-URL upload helper.
  final AccountService _account;

  Future<CreatorProfile> me() async => CreatorProfile.fromJson(asMap(await _api.get('/creator-profiles/me')));

  /// Profile identity, links and the page's on/off switch.
  Future<void> update({
    bool? enabled,
    String? displayName,
    String? avatarUrl,
    String? bio,
    List<ProfileLink>? links,
  }) => _api.post(
    '/creator-profiles/me',
    body: {
      'enabled': ?enabled,
      'displayName': ?displayName,
      'avatarUrl': ?avatarUrl,
      'bio': ?bio,
      if (links != null) 'links': links.map((l) => l.toJson()).toList(),
    },
  );

  Future<void> updateBookingSettings({
    bool? bookingEnabled,
    String? bookingTimezone,
    int? meetingLengthMinutes,
    List<AvailabilityWindow>? availability,
  }) => _api.post(
    '/creator-profiles/me/booking-settings',
    body: {
      'bookingEnabled': ?bookingEnabled,
      'bookingTimezone': ?bookingTimezone,
      'meetingLengthMinutes': ?meetingLengthMinutes,
      if (availability != null) 'availability': availability.map((a) => a.toJson()).toList(),
    },
  );

  Future<void> updateBranding({String? accentColor, String? layout, JsonMap? design}) => _api.post(
    '/creator-profiles/me/branding',
    body: {'accentColor': ?accentColor, 'layout': ?layout, 'design': ?design},
  );

  Future<void> updateDirectorySettings({List<String>? tags, bool? directoryListed}) => _api.post(
    '/creator-profiles/me/directory',
    body: {'tags': ?tags, 'directoryListed': ?directoryListed},
  );

  Future<void> updateMediaKit({
    bool? mediaKitEnabled,
    List<LabeledValue>? stats,
    List<LabeledValue>? collaborations,
    List<LabeledValue>? rateCard,
  }) => _api.post(
    '/creator-profiles/me/media-kit',
    body: {
      'mediaKitEnabled': ?mediaKitEnabled,
      if (stats != null || collaborations != null || rateCard != null)
        'mediaKit': {
          if (stats != null) 'stats': [for (final s in stats) {'label': s.label, 'value': s.value}],
          if (collaborations != null)
            'collaborations': [
              for (final c in collaborations) {'label': c.label, if (c.value.isNotEmpty) 'url': c.value},
            ],
          if (rateCard != null) 'rateCard': [for (final r in rateCard) {'label': r.label, 'price': r.value}],
        },
    },
  );

  Future<void> updatePaidBooking({required bool enabled}) =>
      _api.post('/creator-profiles/me/paid-booking', body: {'paidBookingEnabled': enabled});

  /// Uploads the public profile photo and returns its cache-busted path
  /// (saved with [update] `avatarUrl`).
  Future<String> uploadPhoto(Uint8List png) async {
    final target = asMap(await _api.post('/creator-profiles/photo-upload-url', body: <String, dynamic>{}));
    await _account.putSigned(readString(target, 'signedUploadUrl'), png);
    return '${readString(target, 'path')}?v=${DateTime.now().millisecondsSinceEpoch}';
  }

  Future<ProfileAnalytics> analytics({int rangeDays = 30}) async => ProfileAnalytics.fromJson(
    asMap(await _api.get('/creator-profiles/me/analytics', query: {'rangeDays': rangeDays})),
  );

  Future<List<String>> directoryTags() async =>
      ((await _api.get('/creator-profiles/directory/tags')) as List<dynamic>? ?? const []).map((e) => '$e').toList();

  Future<List<Booking>> bookings() async =>
      asMapList(await _api.get('/creator-profiles/me/bookings')).map(Booking.fromJson).toList();

  /// Returns the accept workflow status: ok, needsGoogleMailbox,
  /// needsReconnect, serviceDisabled, emailFailed or error.
  Future<String> acceptBooking(String id) async => readString(
    asMap(await _api.post('/creator-profiles/bookings/${Uri.encodeComponent(id)}/accept', body: <String, dynamic>{})),
    'status',
    'error',
  );

  Future<void> declineBooking(String id) =>
      _api.post('/creator-profiles/bookings/${Uri.encodeComponent(id)}/decline', body: <String, dynamic>{});
}
