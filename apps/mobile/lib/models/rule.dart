import 'json.dart';

/// Rule action types (packages/api/modules/mailboxes rule schema).
abstract final class RuleActionType {
  static const label = 'LABEL';
  static const archive = 'ARCHIVE';
  static const markRead = 'MARK_READ';
  static const draftEmail = 'DRAFT_EMAIL';
  static const reply = 'REPLY';
  static const forward = 'FORWARD';
  static const markSpam = 'MARK_SPAM';

  static const all = [label, archive, markRead, draftEmail, reply, forward, markSpam];

  static String describe(String type) => switch (type) {
    label => 'Apply label',
    archive => 'Archive',
    markRead => 'Mark as read',
    draftEmail => 'Draft a reply',
    reply => 'Send a reply',
    forward => 'Forward',
    markSpam => 'Mark as spam',
    _ => type,
  };
}

class RuleAction {
  const RuleAction({required this.type, this.fields = const {}});

  final String type;

  /// label, to, cc, bcc, subject, content (all optional strings).
  final Map<String, String> fields;

  String? field(String key) {
    final value = fields[key];
    return (value == null || value.isEmpty) ? null : value;
  }

  factory RuleAction.fromJson(JsonMap json) {
    final raw = asMap(json['fields']);
    return RuleAction(
      type: readString(json, 'type'),
      fields: {
        for (final e in raw.entries)
          if (e.value != null) e.key: e.value.toString(),
      },
    );
  }

  JsonMap toJson() => {
    'type': type,
    if (fields.isNotEmpty)
      'fields': {for (final e in fields.entries) if (e.value.isNotEmpty) e.key: e.value},
  };
}

class RuleCondition {
  const RuleCondition({
    this.operator = 'AND',
    this.aiInstructions,
    this.from,
    this.to,
    this.subject,
  });

  /// `AND` or `OR` between the AI instruction and the static matchers.
  final String operator;
  final String? aiInstructions;
  final String? from;
  final String? to;
  final String? subject;

  bool get hasStatic =>
      (from?.isNotEmpty ?? false) ||
      (to?.isNotEmpty ?? false) ||
      (subject?.isNotEmpty ?? false);

  factory RuleCondition.fromJson(JsonMap json) {
    final s = asMap(json['static']);
    return RuleCondition(
      operator: readStringOrNull(json, 'conditionalOperator') ?? 'AND',
      aiInstructions: readStringOrNull(json, 'aiInstructions'),
      from: readStringOrNull(s, 'from'),
      to: readStringOrNull(s, 'to'),
      subject: readStringOrNull(s, 'subject'),
    );
  }

  JsonMap toJson() => {
    'conditionalOperator': operator,
    'aiInstructions': (aiInstructions?.trim().isEmpty ?? true) ? null : aiInstructions!.trim(),
    'static': hasStatic
        ? {
            'from': _orNull(from),
            'to': _orNull(to),
            'subject': _orNull(subject),
          }
        : null,
  };

  static String? _orNull(String? v) => (v == null || v.trim().isEmpty) ? null : v.trim();
}

/// A rule as stored (`GET /mailboxes/{id}/rules`).
class Rule {
  const Rule({
    required this.id,
    required this.name,
    required this.enabled,
    required this.condition,
    required this.actions,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String name;
  final bool enabled;
  final RuleCondition condition;
  final List<RuleAction> actions;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// The label this rule applies, if it has a LABEL action — the web derives
  /// the sidebar labels from these.
  String? get labelName {
    for (final a in actions) {
      if (a.type == RuleActionType.label) return a.field('label') ?? name;
    }
    return null;
  }

  factory Rule.fromJson(JsonMap json) => Rule(
    id: readString(json, 'id'),
    name: readString(json, 'name'),
    enabled: readBool(json, 'enabled', true),
    condition: RuleCondition.fromJson(asMap(json['condition'])),
    actions: asMapList(json['actions']).map(RuleAction.fromJson).toList(),
    createdAt: readDate(json, 'createdAt'),
    updatedAt: readDate(json, 'updatedAt'),
  );
}

/// Input for creating/updating a rule (also the shape AI compile returns).
class RuleDraft {
  const RuleDraft({
    required this.name,
    required this.condition,
    required this.actions,
    this.enabled = true,
  });

  final String name;
  final RuleCondition condition;
  final List<RuleAction> actions;
  final bool enabled;

  factory RuleDraft.fromJson(JsonMap json) => RuleDraft(
    name: readString(json, 'name'),
    condition: RuleCondition.fromJson(asMap(json['condition'])),
    actions: asMapList(json['actions']).map(RuleAction.fromJson).toList(),
    enabled: readBool(json, 'enabled', true),
  );

  /// From the rules assistant's `proposeRule` tool input (flat `staticFrom`
  /// etc. and inline action fields), as the web's RuleConfirmationCard does.
  /// `NONE` (only one kind of condition) behaves like `AND`.
  factory RuleDraft.fromProposal(JsonMap json) {
    final c = asMap(json['condition']);
    const fieldKeys = ['label', 'to', 'cc', 'bcc', 'subject', 'content', 'webhookUrl', 'folderName'];
    return RuleDraft(
      name: readString(json, 'name', 'New rule'),
      condition: RuleCondition(
        operator: readStringOrNull(c, 'conditionalOperator') == 'OR' ? 'OR' : 'AND',
        aiInstructions: readStringOrNull(c, 'aiInstructions'),
        from: readStringOrNull(c, 'staticFrom'),
        to: readStringOrNull(c, 'staticTo'),
        subject: readStringOrNull(c, 'staticSubject'),
      ),
      actions: [
        for (final a in asMapList(json['actions']))
          RuleAction(
            type: readString(a, 'type'),
            fields: {
              for (final k in fieldKeys)
                if (readStringOrNull(a, k)?.isNotEmpty ?? false) k: readString(a, k),
            },
          ),
      ],
    );
  }

  factory RuleDraft.fromRule(Rule rule) => RuleDraft(
    name: rule.name,
    condition: rule.condition,
    actions: rule.actions,
    enabled: rule.enabled,
  );

  JsonMap toJson() => {
    'name': name,
    'condition': condition.toJson(),
    'actions': actions.map((a) => a.toJson()).toList(),
    'enabled': enabled,
  };
}

class RuleSuggestion {
  const RuleSuggestion({
    required this.id,
    required this.title,
    required this.description,
    required this.reason,
    required this.estimatedMatches,
    required this.confidence,
    required this.category,
    required this.rule,
  });

  final String id;
  final String title;
  final String description;
  final String reason;
  final int estimatedMatches;
  final String confidence;
  final String category;
  final RuleDraft rule;

  factory RuleSuggestion.fromJson(JsonMap json) => RuleSuggestion(
    id: readString(json, 'id'),
    title: readString(json, 'title'),
    description: readString(json, 'description'),
    reason: readString(json, 'reason'),
    estimatedMatches: readInt(json, 'estimatedMatches'),
    confidence: readString(json, 'confidence'),
    category: readString(json, 'category'),
    rule: RuleDraft.fromJson(asMap(json['rule'])),
  );
}

class RuleTestResult {
  const RuleTestResult({
    required this.messageId,
    required this.subject,
    required this.from,
    required this.matched,
  });

  final String messageId;
  final String subject;
  final String from;
  final bool matched;

  factory RuleTestResult.fromJson(JsonMap json) => RuleTestResult(
    messageId: readString(json, 'messageId'),
    subject: readString(json, 'subject'),
    from: readString(json, 'from'),
    matched: readBool(json, 'matched'),
  );
}

class AppliedRuleResult {
  const AppliedRuleResult({
    required this.messageId,
    required this.subject,
    required this.from,
    required this.status,
    required this.actions,
    this.matchedRuleName,
    this.error,
  });

  final String messageId;
  final String subject;
  final String from;

  /// `applied`, `skipped` or `error`.
  final String status;
  final List<String> actions;
  final String? matchedRuleName;
  final String? error;

  factory AppliedRuleResult.fromJson(JsonMap json) => AppliedRuleResult(
    messageId: readString(json, 'messageId'),
    subject: readString(json, 'subject'),
    from: readString(json, 'from'),
    status: readString(json, 'status'),
    actions: readStringList(json, 'actions'),
    matchedRuleName: readStringOrNull(json, 'matchedRuleName'),
    error: readStringOrNull(json, 'error'),
  );
}

/// Progress of applying a rule to past mail (backfill) or of the initial
/// email classification run.
class BackgroundRun {
  const BackgroundRun({
    required this.id,
    required this.status,
    this.processedCount = 0,
    this.matchedCount = 0,
    this.appliedCount = 0,
    this.errorCount = 0,
    this.total,
    this.lastError,
  });

  final String id;

  /// e.g. `running`, `completed`, `failed`.
  final String status;
  final int processedCount;
  final int matchedCount;
  final int appliedCount;
  final int errorCount;
  final int? total;
  final String? lastError;

  bool get isDone => status == 'completed' || status == 'failed' || status == 'cancelled';

  double? get progress =>
      (total != null && total! > 0) ? (processedCount / total!).clamp(0, 1) : null;

  static BackgroundRun? fromJsonOrNull(Object? value) {
    if (value is! Map) return null;
    final json = asMap(value);
    return BackgroundRun(
      id: readString(json, 'id'),
      status: readString(json, 'status'),
      processedCount: readInt(json, 'processedCount'),
      matchedCount: readInt(json, 'matchedCount', readInt(json, 'classifiedCount')),
      appliedCount: readInt(json, 'appliedCount'),
      errorCount: readInt(json, 'errorCount'),
      total: json['estimatedTotal'] is num
          ? readInt(json, 'estimatedTotal')
          : (json['totalAtStart'] is num ? readInt(json, 'totalAtStart') : null),
      lastError: readStringOrNull(json, 'lastError'),
    );
  }
}
