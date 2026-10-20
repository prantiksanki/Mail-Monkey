import '../core/network/api_client.dart';
import '../models/insights.dart';
import '../models/json.dart';
import '../models/rule.dart';

/// Dashboard, stats, analytics, activity, notifications, calendar and the
/// email-classification run.
class InsightsService {
  InsightsService(this._api);

  final ApiClient _api;

  String _mb(String id) => '/mailboxes/${Uri.encodeComponent(id)}';

  Future<DashboardSummary> dashboard(String mailboxId) async =>
      DashboardSummary.fromJson(asMap(await _api.get('${_mb(mailboxId)}/dashboard/summary')));

  Future<MailboxStats> stats(String mailboxId) async =>
      MailboxStats.fromJson(asMap(await _api.get('${_mb(mailboxId)}/stats')));

  Future<AnalyticsOverview> overview() async =>
      AnalyticsOverview.fromJson(asMap(await _api.get('/analytics/overview')));

  Future<List<VolumePoint>> emailVolume({int days = 30}) async => asMapList(
    asMap(await _api.get('/analytics/email-volume', query: {'days': days}))['volume'],
  ).map(VolumePoint.fromJson).toList();

  Future<List<({String sender, int count})>> topSenders({int limit = 10}) async => [
    for (final s in asMapList(
      asMap(await _api.get('/analytics/top-senders', query: {'limit': limit}))['senders'],
    ))
      (sender: readString(s, 'sender'), count: readInt(s, 'count')),
  ];

  /// Rule execution history, newest first. [status]: matched, not_matched, error.
  Future<({List<ExecutionLog> logs, int total})> executionLogs(
    String mailboxId, {
    int limit = 30,
    int offset = 0,
    String? ruleId,
    String? status,
    String? search,
  }) async {
    final data = asMap(
      await _api.get(
        '${_mb(mailboxId)}/execution-logs',
        query: {'limit': limit, 'offset': offset, 'ruleId': ruleId, 'status': status, 'search': search},
      ),
    );
    return (
      logs: asMapList(data['logs']).map(ExecutionLog.fromJson).toList(),
      total: readInt(data, 'total'),
    );
  }

  // --- Notifications ---

  Future<List<AppNotification>> notifications() async => asMapList(
    asMap(await _api.get('/notifications'))['notifications'],
  ).map(AppNotification.fromJson).toList();

  Future<void> markNotificationRead(String id) =>
      _api.post('/notifications/mark-read', body: {'id': id});

  // --- Calendar ---

  Future<CalendarResult> calendarEvents(String mailboxId, {DateTime? from, DateTime? to}) async =>
      CalendarResult.fromJson(
        asMap(
          await _api.get(
            '${_mb(mailboxId)}/calendar/events',
            query: {
              'timeMin': from?.toUtc().toIso8601String(),
              'timeMax': to?.toUtc().toIso8601String(),
            },
          ),
        ),
      );

  /// Returns the backend status: ok, needsReconnect, serviceDisabled, error.
  Future<String> createEvent(
    String mailboxId, {
    required String summary,
    required DateTime start,
    required DateTime end,
    bool allDay = false,
    List<String> attendees = const [],
    String? description,
  }) async {
    String day(DateTime d) =>
        '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    final data = asMap(
      await _api.post(
        '${_mb(mailboxId)}/calendar/event',
        body: {
          'summary': summary,
          if (allDay) ...{'allDay': true, 'startDate': day(start), 'endDate': day(end)}
          else ...{'startIso': start.toUtc().toIso8601String(), 'endIso': end.toUtc().toIso8601String()},
          if (attendees.isNotEmpty) 'attendees': attendees,
          if (description != null && description.isNotEmpty) 'description': description,
        },
      ),
    );
    return readString(data, 'status', 'error');
  }

  /// Creates a video meeting (Google Meet, Zoom, Zoho or Outlook/Teams).
  Future<({String status, String? meetLink})> createMeeting(
    String mailboxId, {
    required String summary,
    required DateTime start,
    required DateTime end,
    String? provider,
    List<String> attendees = const [],
    String? description,
  }) async {
    final data = asMap(
      await _api.post(
        '${_mb(mailboxId)}/calendar/meeting',
        body: {
          'summary': summary,
          'startIso': start.toUtc().toIso8601String(),
          'endIso': end.toUtc().toIso8601String(),
          'provider': ?provider,
          if (attendees.isNotEmpty) 'attendees': attendees,
          if (description != null && description.isNotEmpty) 'description': description,
        },
      ),
    );
    return (
      status: readString(data, 'status', 'error'),
      meetLink: readStringOrNull(asMap(data['meeting']), 'meetLink'),
    );
  }

  // --- Email classification (AI inbox categories) ---

  Future<BackgroundRun?> classificationStatus(String mailboxId) async =>
      BackgroundRun.fromJsonOrNull(asMap(await _api.get('${_mb(mailboxId)}/classification'))['run']);

  Future<BackgroundRun?> startClassification(String mailboxId) async => BackgroundRun.fromJsonOrNull(
    asMap(await _api.post('${_mb(mailboxId)}/classification/start'))['run'],
  );

  Future<BackgroundRun?> advanceClassification(String mailboxId, String runId) async =>
      BackgroundRun.fromJsonOrNull(
        asMap(
          await _api.post('${_mb(mailboxId)}/classification/${Uri.encodeComponent(runId)}/advance'),
        )['run'],
      );

  // --- Mailbox watch (real-time push) ---

  Future<({bool enabled, DateTime? expiry})> watchStatus(String mailboxId) async {
    final data = asMap(await _api.get('${_mb(mailboxId)}/watch/status'));
    return (enabled: readBool(data, 'watchEnabled'), expiry: readDate(data, 'watchExpiry'));
  }

  Future<void> enableWatch(String mailboxId) => _api.post('${_mb(mailboxId)}/watch/enable');

  Future<void> disableWatch(String mailboxId) => _api.post('${_mb(mailboxId)}/watch/disable');

  Future<JsonMap> diagnose(String mailboxId, {bool extended = false}) async =>
      asMap(await _api.post('${_mb(mailboxId)}/${extended ? 'diagnose-extended' : 'diagnose'}'));

  /// Telemetry: the user saw their first inbox summary / suggestions.
  Future<void> markFirstSummaryViewed() => _api.post('/telemetry/first-summary-viewed', body: <String, dynamic>{});
}
