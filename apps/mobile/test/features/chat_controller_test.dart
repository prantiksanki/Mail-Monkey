import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mail_monkey/core/errors/api_exception.dart';
import 'package:mail_monkey/features/ai/chat_controller.dart';
import 'package:mail_monkey/models/ai_chat.dart';
import 'package:mail_monkey/models/json.dart';

void main() {
  test('streams a reply and sends the full history', () async {
    final sent = <List<String>>[];
    final chat = ChatController(
      send: (messages, _) {
        sent.add(messages.map((m) => m.role).toList());
        return Stream.fromIterable([
          {'type': 'start', 'messageId': 'a1'},
          {'type': 'text-start', 'id': 't'},
          {'type': 'text-delta', 'id': 't', 'delta': 'Hi there'},
          {'type': 'finish'},
        ]);
      },
    );

    await chat.sendText('hello');

    expect(sent.single, ['user']);
    expect(chat.messages.map((m) => m.role), ['user', 'assistant']);
    expect(chat.messages.last.text, 'Hi there');
    expect(chat.streaming, isFalse);
    expect(chat.error, isNull);
  });

  test('resubmits the same assistant turn once approvals are answered', () async {
    var call = 0;
    List<ChatMessage>? resubmitted;
    final chat = ChatController(
      send: (messages, _) {
        call++;
        if (call == 1) {
          return Stream.fromIterable(<JsonMap>[
            {'type': 'start', 'messageId': 'a1'},
            {'type': 'tool-input-available', 'toolCallId': 'c1', 'toolName': 'sendEmail', 'input': {'to': 'x@y.z'}},
            {'type': 'tool-approval-request', 'approvalId': 'ap1', 'toolCallId': 'c1'},
            {'type': 'finish'},
          ]);
        }
        resubmitted = [for (final m in messages) m.copy()];
        return Stream.fromIterable(<JsonMap>[
          {'type': 'tool-output-available', 'toolCallId': 'c1', 'output': {'sent': true}},
          {'type': 'text-start', 'id': 't'},
          {'type': 'text-delta', 'id': 't', 'delta': 'Sent!'},
        ]);
      },
    );

    await chat.sendText('email x');
    expect(chat.messages.last.tools.single.awaitingApproval, isTrue);

    await chat.answerApproval('ap1', approved: true);

    expect(call, 2);
    // The approved tool part goes back to the server inside the same message.
    expect(resubmitted!.last.parts.first['approval'], {'id': 'ap1', 'approved': true});
    expect(chat.messages.length, 2);
    expect(chat.messages.last.tools.single.isDone, isTrue);
    expect(chat.messages.last.text, 'Sent!');
  });

  test('a cancelled approval is sent with the web\'s "User declined" reason', () async {
    var call = 0;
    List<ChatMessage>? resubmitted;
    final chat = ChatController(
      send: (messages, _) {
        call++;
        if (call == 1) {
          return Stream.fromIterable(<JsonMap>[
            {'type': 'tool-input-available', 'toolCallId': 'c1', 'toolName': 'sendEmail', 'input': {'to': 'x@y.z'}},
            {'type': 'tool-approval-request', 'approvalId': 'ap1', 'toolCallId': 'c1'},
          ]);
        }
        resubmitted = [for (final m in messages) m.copy()];
        return const Stream<JsonMap>.empty();
      },
    );

    await chat.sendText('email x');
    await chat.answerApproval('ap1', approved: false);

    expect(resubmitted!.last.parts.single['approval'], {'id': 'ap1', 'approved': false, 'reason': 'User declined'});
  });

  test('client tool output continues the turn', () async {
    var call = 0;
    final chat = ChatController(
      send: (messages, _) {
        call++;
        return call == 1
            ? Stream.fromIterable(<JsonMap>[
                {'type': 'tool-input-available', 'toolCallId': 'r1', 'toolName': 'proposeRule', 'input': {'name': 'N'}},
              ])
            : Stream.fromIterable(<JsonMap>[
                {'type': 'text-start', 'id': 't'},
                {'type': 'text-delta', 'id': 't', 'delta': 'Rule created!'},
              ]);
      },
    );
    await chat.sendText('make a rule');
    await chat.provideToolOutput('r1', {'action': 'accepted'});

    expect(call, 2);
    expect(chat.messages.last.tools.single.output, {'action': 'accepted'});
    expect(chat.messages.last.text, 'Rule created!');
  });

  test('server errors surface without leaving an empty assistant bubble', () async {
    final chat = ChatController(
      send: (_, _) => Stream<JsonMap>.error(
        const ApiException(code: 'FORBIDDEN', message: 'Premium only', status: 403),
      ),
    );
    await chat.sendText('hi');
    expect(chat.messages.map((m) => m.role), ['user']);
    expect(chat.error, isNotNull);
  });

  test('stopping a stream is not reported as an error', () async {
    final chat = ChatController(
      send: (_, cancel) => Stream<JsonMap>.error(
        DioException.requestCancelled(requestOptions: RequestOptions(), reason: 'stopped'),
      ),
    );
    await chat.sendText('hi');
    expect(chat.error, isNull);
  });
}
