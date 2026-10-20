import 'package:flutter_test/flutter_test.dart';
import 'package:mail_monkey/features/mail/message/email_html.dart';
import 'package:mail_monkey/models/rule.dart';

void main() {
  test('converts a rules-assistant proposal to the create-rule body like the web', () {
    final draft = RuleDraft.fromProposal({
      'name': 'Stripe Finance',
      'condition': {'conditionalOperator': 'NONE', 'staticFrom': 'billing@stripe.com'},
      'actions': [
        {'type': 'LABEL', 'label': 'Finance'},
        {'type': 'MARK_READ'},
      ],
    });

    expect(draft.toJson(), {
      'name': 'Stripe Finance',
      'condition': {
        'conditionalOperator': 'AND',
        'aiInstructions': null,
        'static': {'from': 'billing@stripe.com', 'to': null, 'subject': null},
      },
      'actions': [
        {
          'type': 'LABEL',
          'fields': {'label': 'Finance'},
        },
        {'type': 'MARK_READ'},
      ],
      'enabled': true,
    });
  });

  test('keeps OR and AI-only conditions', () {
    final draft = RuleDraft.fromProposal({
      'name': 'News',
      'condition': {'conditionalOperator': 'OR', 'aiInstructions': 'Newsletters'},
      'actions': [
        {'type': 'FORWARD', 'to': 'a@b.com', 'subject': ''},
      ],
    });
    final json = draft.toJson();
    expect((json['condition'] as Map)['conditionalOperator'], 'OR');
    expect((json['condition'] as Map)['static'], isNull);
    expect((json['actions'] as List).single, {
      'type': 'FORWARD',
      'fields': {'to': 'a@b.com'},
    });
  });

  test('pickEmail never returns a display name', () {
    expect(pickEmail(['Jane <jane@x.com>']), 'jane@x.com');
    expect(pickEmail(['', 'bob@y.org']), 'bob@y.org');
    expect(pickEmail(['Just A Name']), '');
  });

  test('htmlToText strips markup and decodes basic entities', () {
    expect(
      htmlToText('<style>p{}</style><p>Hi&nbsp;there</p><div>A &amp; B</div>'),
      'Hi there\n A & B',
    );
  });
}
