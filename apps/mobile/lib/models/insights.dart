import 'json.dart';

/// `GET /mailboxes/{id}/dashboard/summary`.
class DashboardSummary {
  const DashboardSummary({
    required this.aiInsight,
    required this.inboxZeroPercent,
    required this.priorityCount,
    required this.categories,
    required this.categorizedTotal,
    required this.uncategorizedCount,
    required this.topSenders,
  });

  final String aiInsight;
  final double inboxZeroPercent;
  final int priorityCount;

  /// PRIMARY / NEWSLETTER / PROMOTION / SOCIAL → count.
  final Map<String, int> categories;
  final int categorizedTotal;
  final int uncategorizedCount;
  final List<({String from, String fromEmail, int count})> topSenders;

  factory DashboardSummary.fromJson(JsonMap json) => DashboardSummary(
    aiInsight: readString(json, 'aiInsight'),
    inboxZeroPercent: readDouble(json, 'inboxZeroPercent'),
    priorityCount: readInt(json, 'priorityCount'),
    categories: {
      for (final c in asMapList(json['categoryBreakdown']))
        readString(c, 'category'): readInt(c, 'count'),
    },
    categorizedTotal: readInt(json, 'categorizedTotal'),
    uncategorizedCount: readInt(json, 'uncategorizedCount'),
    topSenders: [
      for (final s in asMapList(json['topSenders']))
        (from: readString(s, 'from'), fromEmail: readString(s, 'fromEmail'), count: readInt(s, 'count')),
    ],
  );
}

/// `GET /mailboxes/{id}/stats` (database MailboxStats).
class MailboxStats {
  const MailboxStats({
    required this.processedToday,
    required this.processedYesterday,
    required this.firedToday,
    required this.firedYesterday,
    required this.errorsToday,
    required this.processed7d,
    required this.fired7d,
    required this.rulesActive,
    required this.rulesTotal,
    required this.sparkline,
    required this.topRules,
    required this.actionsBreakdown,
  });

  final int processedToday;
  final int processedYesterday;
  final int firedToday;
  final int firedYesterday;
  final int errorsToday;
  final int processed7d;
  final int fired7d;
  final int rulesActive;
  final int rulesTotal;
  final List<({String day, int processed, int fired})> sparkline;
  final List<({String id, String name, int count})> topRules;
  final List<({String type, int count})> actionsBreakdown;

  factory MailboxStats.fromJson(JsonMap json) => MailboxStats(
    processedToday: readInt(json, 'processedToday'),
    processedYesterday: readInt(json, 'processedYesterday'),
    firedToday: readInt(json, 'firedToday'),
    firedYesterday: readInt(json, 'firedYesterday'),
    errorsToday: readInt(json, 'errorsToday'),
    processed7d: readInt(json, 'processed7d'),
    fired7d: readInt(json, 'fired7d'),
    rulesActive: readInt(json, 'rulesActive'),
    rulesTotal: readInt(json, 'rulesTotal'),
    sparkline: [
      for (final d in asMapList(json['sparkline7d']))
        (day: readString(d, 'day'), processed: readInt(d, 'processed'), fired: readInt(d, 'fired')),
    ],
    topRules: [
      for (final r in asMapList(json['topRules7d']))
        (id: readString(r, 'id'), name: readString(r, 'name'), count: readInt(r, 'count')),
    ],
    actionsBreakdown: [
      for (final a in asMapList(json['actionsBreakdown24h']))
        (type: readString(a, 'type'), count: readInt(a, 'count')),
    ],
  );
}

/// `GET /analytics/overview`.
class AnalyticsOverview {
  const AnalyticsOverview({
    required this.totalEmailsProcessed,
    required this.successRate,
    required this.matched,
    required this.errors,
    required this.activeRules,
    required this.totalRules,
  });

  final int totalEmailsProcessed;
  final double successRate;
  final int matched;
  final int errors;
  final int activeRules;
  final int totalRules;

  factory AnalyticsOverview.fromJson(JsonMap json) {
    final rate = asMap(json['automationSuccessRate']);
    final rules = asMap(json['activeRules']);
    return AnalyticsOverview(
      totalEmailsProcessed: readInt(json, 'totalEmailsProcessed'),
      successRate: readDouble(rate, 'rate'),
      matched: readInt(rate, 'matched'),
      errors: readInt(rate, 'errors'),
      activeRules: readInt(rules, 'active'),
      totalRules: readInt(rules, 'total'),
    );
  }
}

class VolumePoint {
  const VolumePoint({required this.date, required this.total, required this.matched, required this.errors});

  final String date;
  final int total;
  final int matched;
  final int errors;

  factory VolumePoint.fromJson(JsonMap json) => VolumePoint(
    date: readString(json, 'date'),
    total: readInt(json, 'total'),
    matched: readInt(json, 'matched'),
    errors: readInt(json, 'errors'),
  );
}

/// Rule execution log entry (`GET /mailboxes/{id}/execution-logs`).
class ExecutionLog {
  const ExecutionLog({
    required this.id,
    required this.ruleName,
    required this.status,
    required this.messageId,
    this.subject,
    this.from,
    this.error,
    this.createdAt,
    this.actionsRun = const [],
  });

  final String id;
  final String ruleName;

  /// `matched`, `not_matched` or `error`.
  final String status;
  final String messageId;
  final String? subject;
  final String? from;
  final String? error;
  final DateTime? createdAt;
  final List<String> actionsRun;

  factory ExecutionLog.fromJson(JsonMap json) {
    final actions = json['actionsRun'];
    return ExecutionLog(
      id: readString(json, 'id'),
      ruleName: readString(asMap(json['rule']), 'name'),
      status: readString(json, 'status'),
      messageId: readString(json, 'messageId'),
      subject: readStringOrNull(json, 'subject'),
      from: readStringOrNull(json, 'from'),
      error: readStringOrNull(json, 'error'),
      createdAt: readDate(json, 'createdAt'),
      actionsRun: actions is List
          ? actions.map((a) => a is Map ? readString(asMap(a), 'type', a.toString()) : a.toString()).toList()
          : const [],
    );
  }
}

/// In-app notification (`GET /notifications`).
class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    this.emailId,
    this.createdAt,
    this.readAt,
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final String? emailId;
  final DateTime? createdAt;
  final DateTime? readAt;

  bool get isRead => readAt != null;

  factory AppNotification.fromJson(JsonMap json) => AppNotification(
    id: readString(json, 'id'),
    type: readString(json, 'type'),
    title: readString(json, 'title'),
    body: readString(json, 'body'),
    emailId: readStringOrNull(json, 'emailId'),
    createdAt: readDate(json, 'createdAt'),
    readAt: readDate(json, 'readAt'),
  );
}

/// Calendar event (`GET /mailboxes/{id}/calendar/events`).
class CalendarEvent {
  const CalendarEvent({
    required this.id,
    required this.summary,
    required this.isAllDay,
    this.start,
    this.end,
    this.location,
  });

  final String id;
  final String summary;
  final bool isAllDay;
  final DateTime? start;
  final DateTime? end;
  final String? location;

  factory CalendarEvent.fromJson(JsonMap json) => CalendarEvent(
    id: readString(json, 'id'),
    summary: readStringOrNull(json, 'summary') ?? '(no title)',
    isAllDay: readBool(json, 'isAllDay'),
    start: readDate(json, 'start'),
    end: readDate(json, 'end'),
    location: readStringOrNull(json, 'location'),
  );
}

class CalendarResult {
  const CalendarResult({
    required this.events,
    this.needsReconnect = false,
    this.serviceDisabled = false,
    this.calendarError,
  });

  final List<CalendarEvent> events;
  final bool needsReconnect;
  final bool serviceDisabled;
  final String? calendarError;

  factory CalendarResult.fromJson(JsonMap json) => CalendarResult(
    events: asMapList(json['events']).map(CalendarEvent.fromJson).toList(),
    needsReconnect: readBool(json, 'needsReconnect'),
    serviceDisabled: readBool(json, 'serviceDisabled'),
    calendarError: readStringOrNull(json, 'calendarError'),
  );
}
