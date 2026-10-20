import 'package:flutter_test/flutter_test.dart';
import 'package:mail_monkey/models/ai_chat.dart';

void main() {
  test('applies text deltas and step markers like the AI SDK', () {
    final msg = ChatMessage(id: 'tmp', role: 'assistant');
    ChatStreamApplier(msg)
      ..apply({'type': 'start', 'messageId': 'm1'})
      ..apply({'type': 'start-step'})
      ..apply({'type': 'text-start', 'id': 't1'})
      ..apply({'type': 'text-delta', 'id': 't1', 'delta': 'Hello '})
      ..apply({'type': 'text-delta', 'id': 't1', 'delta': 'Sanyam'})
      ..apply({'type': 'text-end', 'id': 't1'})
      ..apply({'type': 'finish'});

    expect(msg.id, 'm1');
    expect(msg.text, 'Hello Sanyam');
    expect(msg.parts.first, {'type': 'step-start'});
    expect(msg.parts.last['state'], 'done');
  });

  test('tracks a tool call through approval and output', () {
    final msg = ChatMessage(id: 'm', role: 'assistant');
    final applier = ChatStreamApplier(msg)
      ..apply({'type': 'tool-input-start', 'toolCallId': 'c1', 'toolName': 'sendEmail'})
      ..apply({
        'type': 'tool-input-available',
        'toolCallId': 'c1',
        'toolName': 'sendEmail',
        'input': {'to': 'a@b.com', 'subject': 'Hi'},
      })
      ..apply({'type': 'tool-approval-request', 'approvalId': 'ap1', 'toolCallId': 'c1'});

    final tool = msg.tools.single;
    expect(tool.name, 'sendEmail');
    expect(tool.awaitingApproval, isTrue);
    expect(tool.input['to'], 'a@b.com');
    expect(readyToResubmitAfterApprovals([msg]), isFalse);

    respondToApproval(msg, 'ap1', approved: true);
    expect(msg.tools.single.state, 'approval-responded');
    expect(msg.parts.single['approval'], {'id': 'ap1', 'approved': true});
    expect(readyToResubmitAfterApprovals([msg]), isTrue);

    applier.apply({'type': 'tool-output-available', 'toolCallId': 'c1', 'output': {'ok': true}});
    expect(msg.tools.single.isDone, isTrue);
  });

  test('surfaces stream errors and records client tool output', () {
    final msg = ChatMessage(id: 'm', role: 'assistant');
    final applier = ChatStreamApplier(msg)
      ..apply({'type': 'tool-input-available', 'toolCallId': 'r1', 'toolName': 'proposeRule', 'input': {'name': 'X'}})
      ..apply({'type': 'error', 'errorText': 'Rate limited'});

    expect(applier.error, 'Rate limited');
    addToolOutput(msg, 'r1', {'action': 'accepted'});
    expect(msg.tools.single.state, 'output-available');
    expect(msg.tools.single.output, {'action': 'accepted'});
  });

  test('round-trips persisted messages to the UIMessage JSON shape', () {
    final json = {
      'id': 'x',
      'role': 'assistant',
      'parts': [
        {'type': 'text', 'text': 'Hi'},
        {'type': 'data-citation', 'data': {'ids': ['e1']}},
      ],
    };
    final msg = ChatMessage.fromJson(json);
    expect(msg.toJson(), json);
    expect(ChatMessage.user('hey').toJson()['parts'], [
      {'type': 'text', 'text': 'hey'},
    ]);
  });
}
