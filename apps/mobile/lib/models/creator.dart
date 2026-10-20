import 'json.dart';

/// Link platforms accepted by the API (creator-profiles linkPlatformSchema).
const linkPlatforms = ['website', 'instagram', 'facebook', 'x', 'linkedin', 'github', 'tiktok', 'youtube', 'custom'];

class ProfileLink {
  const ProfileLink({
    required this.label,
    this.url,
    this.type = 'url',
    this.platform,
    this.featured = false,
    this.enabled = true,
  });

  final String label;
  final String? url;

  /// `url` or `contact-form` (which needs no URL).
  final String type;
  final String? platform;
  final bool featured;
  final bool enabled;

  bool get isContactForm => type == 'contact-form';

  factory ProfileLink.fromJson(JsonMap json) => ProfileLink(
    label: readString(json, 'label'),
    url: readStringOrNull(json, 'url'),
    type: readString(json, 'type', 'url'),
    platform: readStringOrNull(json, 'platform'),
    featured: readBool(json, 'featured'),
    enabled: readBool(json, 'enabled', true),
  );

  JsonMap toJson() => {
    'label': label,
    if (!isContactForm && (url?.isNotEmpty ?? false)) 'url': url,
    'type': type,
    'platform': ?platform,
    'featured': featured,
    'enabled': enabled,
  };

  ProfileLink copyWith({String? label, String? url, String? type, String? platform, bool? featured, bool? enabled}) =>
      ProfileLink(
        label: label ?? this.label,
        url: url ?? this.url,
        type: type ?? this.type,
        platform: platform ?? this.platform,
        featured: featured ?? this.featured,
        enabled: enabled ?? this.enabled,
      );
}

/// A weekly availability window (`dayOfWeek` 0 = Sunday, `HH:mm` times).
class AvailabilityWindow {
  const AvailabilityWindow({required this.dayOfWeek, required this.startTime, required this.endTime});

  final int dayOfWeek;
  final String startTime;
  final String endTime;

  factory AvailabilityWindow.fromJson(JsonMap json) => AvailabilityWindow(
    dayOfWeek: readInt(json, 'dayOfWeek'),
    startTime: readString(json, 'startTime', '09:00'),
    endTime: readString(json, 'endTime', '17:00'),
  );

  JsonMap toJson() => {'dayOfWeek': dayOfWeek, 'startTime': startTime, 'endTime': endTime};
}

class LabeledValue {
  const LabeledValue(this.label, this.value);

  final String label;
  final String value;
}

/// The signed-in creator's own profile (`GET /creator-profiles/me`).
class CreatorProfile {
  const CreatorProfile({
    required this.enabled,
    required this.bio,
    required this.links,
    required this.bookingEnabled,
    required this.bookingTimezone,
    required this.meetingLengthMinutes,
    required this.availability,
    required this.accentColor,
    required this.layout,
    required this.design,
    required this.mediaKitEnabled,
    required this.stats,
    required this.collaborations,
    required this.rateCard,
    required this.tags,
    required this.directoryListed,
    required this.paidBookingEnabled,
    this.displayName,
    this.avatarUrl,
  });

  final bool enabled;
  final String? displayName;
  final String? avatarUrl;
  final String bio;
  final List<ProfileLink> links;
  final bool bookingEnabled;
  final String bookingTimezone;
  final int meetingLengthMinutes;
  final List<AvailabilityWindow> availability;
  final String accentColor;

  /// `STANDARD` or `COMPACT`.
  final String layout;

  /// Raw design settings (button style, colours, wallpaper…), kept as JSON so
  /// options the app doesn't edit are preserved.
  final JsonMap design;
  final bool mediaKitEnabled;
  final List<LabeledValue> stats;

  /// label → optional url.
  final List<LabeledValue> collaborations;

  /// label → price.
  final List<LabeledValue> rateCard;
  final List<String> tags;
  final bool directoryListed;
  final bool paidBookingEnabled;

  factory CreatorProfile.fromJson(JsonMap json) {
    final kit = asMap(json['mediaKit']);
    return CreatorProfile(
      enabled: readBool(json, 'enabled'),
      displayName: readStringOrNull(json, 'displayName'),
      avatarUrl: readStringOrNull(json, 'avatarUrl'),
      bio: readString(json, 'bio'),
      links: asMapList(json['links']).map(ProfileLink.fromJson).toList(),
      bookingEnabled: readBool(json, 'bookingEnabled'),
      bookingTimezone: readString(json, 'bookingTimezone', 'UTC'),
      meetingLengthMinutes: readInt(json, 'meetingLengthMinutes', 30),
      availability: asMapList(json['availability']).map(AvailabilityWindow.fromJson).toList(),
      accentColor: readString(json, 'accentColor', '#0663DA'),
      layout: readString(json, 'layout', 'STANDARD'),
      design: asMap(json['design']),
      mediaKitEnabled: readBool(json, 'mediaKitEnabled'),
      stats: [for (final s in asMapList(kit['stats'])) LabeledValue(readString(s, 'label'), readString(s, 'value'))],
      collaborations: [
        for (final c in asMapList(kit['collaborations'])) LabeledValue(readString(c, 'label'), readString(c, 'url')),
      ],
      rateCard: [for (final r in asMapList(kit['rateCard'])) LabeledValue(readString(r, 'label'), readString(r, 'price'))],
      tags: readStringList(json, 'tags'),
      directoryListed: readBool(json, 'directoryListed'),
      paidBookingEnabled: readBool(json, 'paidBookingEnabled'),
    );
  }
}

class ProfileAnalytics {
  const ProfileAnalytics({required this.views, required this.contacts, required this.bookings, required this.daily});

  final int views;
  final int contacts;
  final int bookings;
  final List<({String date, int count})> daily;

  factory ProfileAnalytics.fromJson(JsonMap json) => ProfileAnalytics(
    views: readInt(json, 'views'),
    contacts: readInt(json, 'contacts'),
    bookings: readInt(json, 'bookings'),
    daily: [for (final d in asMapList(json['dailyViews'])) (date: readString(d, 'date'), count: readInt(d, 'count'))],
  );
}

class Booking {
  const Booking({
    required this.id,
    required this.status,
    required this.visitorName,
    required this.visitorEmail,
    required this.paid,
    this.note,
    this.startsAt,
    this.endsAt,
    this.meetLink,
    this.acceptError,
  });

  final String id;

  /// PENDING, ACCEPTING (accept in progress or stuck — retryable),
  /// CONFIRMED, DECLINED, CANCELED.
  final String status;
  final String visitorName;
  final String visitorEmail;
  final bool paid;
  final String? note;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final String? meetLink;
  final String? acceptError;

  bool get isPending => status == 'PENDING' || status == 'ACCEPTING';

  String get statusLabel => switch (status) {
    'PENDING' => 'Awaiting your response',
    'ACCEPTING' => 'Finishing setup — retry if stuck',
    'CONFIRMED' => 'Confirmed',
    'DECLINED' => 'Declined',
    'CANCELED' => 'Canceled',
    _ => status,
  };

  factory Booking.fromJson(JsonMap json) => Booking(
    id: readString(json, 'id'),
    status: readString(json, 'status'),
    visitorName: readString(json, 'visitorName'),
    visitorEmail: readString(json, 'visitorEmail'),
    paid: readBool(json, 'paid'),
    note: readStringOrNull(json, 'note'),
    startsAt: readDate(json, 'startsAt'),
    endsAt: readDate(json, 'endsAt'),
    meetLink: readStringOrNull(json, 'meetLink'),
    acceptError: readStringOrNull(json, 'acceptError'),
  );
}
