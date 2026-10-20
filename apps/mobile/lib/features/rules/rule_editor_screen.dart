import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/rule.dart';
import '../../shared/widgets/state_views.dart';
import '../mail/compose/compose_screen.dart';
import '../mail/mail_providers.dart';

/// Create or edit a rule. [initial] is a [Rule] (edit), a [RuleDraft]
/// (review an AI-generated/suggested rule before saving) or null (new).
class RuleEditorScreen extends ConsumerStatefulWidget {
  const RuleEditorScreen({super.key, this.initial});

  final Object? initial;

  @override
  ConsumerState<RuleEditorScreen> createState() => _RuleEditorScreenState();
}

class _ActionDraft {
  _ActionDraft(this.type, Map<String, String> fields)
    : controllers = {
        for (final key in const ['label', 'to', 'cc', 'bcc', 'subject', 'content'])
          key: TextEditingController(text: fields[key] ?? ''),
      };

  String type;
  final Map<String, TextEditingController> controllers;

  RuleAction toAction() => RuleAction(
    type: type,
    fields: {
      for (final key in _fieldsFor(type))
        if (controllers[key]!.text.trim().isNotEmpty) key: controllers[key]!.text.trim(),
    },
  );

  void dispose() {
    for (final c in controllers.values) {
      c.dispose();
    }
  }
}

/// Which fields each action type uses (mirrors the web rule editor).
List<String> _fieldsFor(String type) => switch (type) {
  RuleActionType.label => const ['label'],
  RuleActionType.forward => const ['to', 'cc', 'bcc'],
  RuleActionType.reply || RuleActionType.draftEmail => const ['content'],
  _ => const [],
};

const _fieldLabels = {
  'label': 'Label name',
  'to': 'Forward to',
  'cc': 'Cc',
  'bcc': 'Bcc',
  'subject': 'Subject',
  'content': 'Reply instructions or text',
};

class _RuleEditorScreenState extends ConsumerState<RuleEditorScreen> {
  final _formKey = GlobalKey<FormState>();
  late final String? _ruleId;
  late final TextEditingController _name;
  late final TextEditingController _ai;
  late final TextEditingController _from;
  late final TextEditingController _to;
  late final TextEditingController _subject;
  late String _operator;
  late bool _enabled;
  late final List<_ActionDraft> _actions;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final initial = widget.initial;
    final RuleDraft draft;
    if (initial is Rule) {
      _ruleId = initial.id;
      draft = RuleDraft.fromRule(initial);
    } else {
      _ruleId = null;
      draft = initial is RuleDraft
          ? initial
          : const RuleDraft(name: '', condition: RuleCondition(), actions: [RuleAction(type: RuleActionType.label)]);
    }
    _name = TextEditingController(text: draft.name);
    _ai = TextEditingController(text: draft.condition.aiInstructions ?? '');
    _from = TextEditingController(text: draft.condition.from ?? '');
    _to = TextEditingController(text: draft.condition.to ?? '');
    _subject = TextEditingController(text: draft.condition.subject ?? '');
    _operator = draft.condition.operator;
    _enabled = draft.enabled;
    _actions = [for (final a in draft.actions) _ActionDraft(a.type, a.fields)];
  }

  @override
  void dispose() {
    for (final c in [_name, _ai, _from, _to, _subject]) {
      c.dispose();
    }
    for (final a in _actions) {
      a.dispose();
    }
    super.dispose();
  }

  RuleDraft _draft() => RuleDraft(
    name: _name.text.trim(),
    enabled: _enabled,
    condition: RuleCondition(
      operator: _operator,
      aiInstructions: _ai.text,
      from: _from.text,
      to: _to.text,
      subject: _subject.text,
    ),
    actions: _actions.map((a) => a.toAction()).toList(),
  );

  Future<void> _save() async {
    final mailbox = ref.read(selectedMailboxProvider);
    if (mailbox == null || !(_formKey.currentState?.validate() ?? false)) return;
    final draft = _draft();
    final hasCondition = (draft.condition.aiInstructions?.trim().isNotEmpty ?? false) || draft.condition.hasStatic;
    if (!hasCondition) {
      showMessage(context, 'Add an AI instruction or a From/To/Subject condition.', error: true);
      return;
    }
    if (draft.actions.isEmpty) {
      showMessage(context, 'Add at least one action.', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      final rules = ref.read(rulesServiceProvider);
      if (_ruleId == null) {
        await rules.create(mailbox.id, draft);
      } else {
        await rules.update(mailbox.id, _ruleId, draft);
      }
      ref.invalidate(rulesProvider(mailbox.id));
      if (!mounted) return;
      showMessage(context, _ruleId == null ? 'Rule created' : 'Rule saved');
      context.pop();
    } catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(_ruleId == null ? 'New rule' : 'Edit rule'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Save'),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _name,
              decoration: const InputDecoration(labelText: 'Rule name'),
              textCapitalization: TextCapitalization.sentences,
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Name is required' : null,
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Enabled'),
              value: _enabled,
              onChanged: (v) => setState(() => _enabled = v),
            ),
            const SizedBox(height: 8),
            Text('When an email…', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            TextFormField(
              controller: _ai,
              minLines: 2,
              maxLines: 5,
              decoration: const InputDecoration(
                labelText: 'Matches this description (AI)',
                hintText: 'e.g. is an invoice or payment request from a vendor',
              ),
            ),
            const SizedBox(height: 12),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'AND', label: Text('All conditions')),
                ButtonSegment(value: 'OR', label: Text('Any condition')),
              ],
              selected: {_operator},
              onSelectionChanged: (s) => setState(() => _operator = s.first),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _from,
              decoration: const InputDecoration(labelText: 'From contains (optional)'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _to,
              decoration: const InputDecoration(labelText: 'To contains (optional)'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _subject,
              decoration: const InputDecoration(labelText: 'Subject contains (optional)'),
            ),
            const SizedBox(height: 20),
            Text('Then…', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            for (var i = 0; i < _actions.length; i++) _actionCard(i),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () => setState(() => _actions.add(_ActionDraft(RuleActionType.archive, const {}))),
              icon: const Icon(Icons.add),
              label: const Text('Add action'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _actionCard(int index) {
    final action = _actions[index];
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 4, 12),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: RuleActionType.all.contains(action.type) ? action.type : RuleActionType.label,
                    decoration: const InputDecoration(labelText: 'Action'),
                    items: [
                      for (final t in RuleActionType.all)
                        DropdownMenuItem(value: t, child: Text(RuleActionType.describe(t))),
                    ],
                    onChanged: (v) => setState(() => action.type = v ?? action.type),
                  ),
                ),
                IconButton(
                  tooltip: 'Remove action',
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () => setState(() => _actions.removeAt(index).dispose()),
                ),
              ],
            ),
            for (final key in _fieldsFor(action.type))
              Padding(
                padding: const EdgeInsets.only(top: 12, right: 8),
                child: TextFormField(
                  controller: action.controllers[key],
                  minLines: key == 'content' ? 2 : 1,
                  maxLines: key == 'content' ? 6 : 1,
                  keyboardType: const {'to', 'cc', 'bcc'}.contains(key) ? TextInputType.emailAddress : TextInputType.text,
                  decoration: InputDecoration(labelText: _fieldLabels[key]),
                  validator: (v) {
                    final value = v?.trim() ?? '';
                    if ((key == 'label' || key == 'to') && value.isEmpty) return '${_fieldLabels[key]} is required';
                    if (const {'to', 'cc', 'bcc'}.contains(key)) return validateRecipients(value, required: key == 'to');
                    return null;
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
