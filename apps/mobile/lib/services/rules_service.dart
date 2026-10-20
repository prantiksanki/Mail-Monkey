import '../core/network/api_client.dart';
import '../models/json.dart';
import '../models/rule.dart';

/// Rules endpoints (`/mailboxes/{id}/rules/*`).
class RulesService {
  RulesService(this._api);

  final ApiClient _api;

  String _rules(String mailboxId) =>
      '/mailboxes/${Uri.encodeComponent(mailboxId)}/rules';

  Future<List<Rule>> list(String mailboxId) async => asMapList(
    asMap(await _api.get(_rules(mailboxId)))['rules'],
  ).map(Rule.fromJson).toList();

  Future<Rule> create(String mailboxId, RuleDraft draft) async => Rule.fromJson(
    asMap(
      asMap(
        await _api.post(_rules(mailboxId), body: {'data': draft.toJson()}),
      )['rule'],
    ),
  );

  Future<Rule> update(String mailboxId, String id, RuleDraft draft) async =>
      Rule.fromJson(
        asMap(
          asMap(
            await _api.put(
              '${_rules(mailboxId)}/${Uri.encodeComponent(id)}',
              body: {'data': draft.toJson()},
            ),
          )['rule'],
        ),
      );

  Future<void> delete(String mailboxId, String id) =>
      _api.delete('${_rules(mailboxId)}/${Uri.encodeComponent(id)}');

  Future<Rule> toggle(String mailboxId, String id, {required bool enabled}) async =>
      Rule.fromJson(
        asMap(
          asMap(
            await _api.put(
              '${_rules(mailboxId)}/${Uri.encodeComponent(id)}/toggle',
              body: {'enabled': enabled},
            ),
          )['rule'],
        ),
      );

  /// Runs the rule against recent mail without applying actions.
  Future<({List<RuleTestResult> results, int matchCount, int total})> test(
    String mailboxId,
    String id,
  ) async {
    final data = asMap(
      await _api.post('${_rules(mailboxId)}/${Uri.encodeComponent(id)}/test'),
    );
    return (
      results: asMapList(data['results']).map(RuleTestResult.fromJson).toList(),
      matchCount: readInt(data, 'matchCount'),
      total: readInt(data, 'total'),
    );
  }

  /// Turns a plain-English description into rule drafts (AI).
  Future<List<RuleDraft>> compile(String mailboxId, String prompt) async =>
      asMapList(
        asMap(
          await _api.post('${_rules(mailboxId)}/compile', body: {'prompt': prompt}),
        )['rules'],
      ).map(RuleDraft.fromJson).toList();

  Future<List<RuleSuggestion>> suggestions(String mailboxId) async => asMapList(
    asMap(await _api.get('${_rules(mailboxId)}/suggestions'))['suggestions'],
  ).map(RuleSuggestion.fromJson).toList();

  /// Applies all enabled rules to recent inbox mail.
  Future<List<AppliedRuleResult>> applyToRecent(String mailboxId) async =>
      asMapList(
        asMap(await _api.post('${_rules(mailboxId)}/apply-recent'))['results'],
      ).map(AppliedRuleResult.fromJson).toList();

  // --- Backfill (apply one rule to older mail) ---

  Future<BackgroundRun?> backfillStatus(String mailboxId, String ruleId) async =>
      BackgroundRun.fromJsonOrNull(
        asMap(
          await _api.get('${_rules(mailboxId)}/${Uri.encodeComponent(ruleId)}/backfill'),
        )['run'],
      );

  /// [windowMonths]: 1, 3, 6 or 12.
  Future<BackgroundRun?> startBackfill(
    String mailboxId,
    String ruleId, {
    int windowMonths = 3,
  }) async => BackgroundRun.fromJsonOrNull(
    asMap(
      await _api.post(
        '${_rules(mailboxId)}/${Uri.encodeComponent(ruleId)}/backfill/start',
        body: {'windowMonths': '$windowMonths'},
      ),
    )['run'],
  );

  Future<BackgroundRun?> advanceBackfill(String mailboxId, String runId) async =>
      BackgroundRun.fromJsonOrNull(
        asMap(
          await _api.post(
            '${_rules(mailboxId)}/backfill/${Uri.encodeComponent(runId)}/advance',
          ),
        )['run'],
      );
}
