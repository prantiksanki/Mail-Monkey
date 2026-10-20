import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../../core/routing/routes.dart';
import '../../services/ai_service.dart';
import '../../shared/widgets/state_views.dart';
import '../mail/compose/compose_screen.dart';
import '../mail/mail_providers.dart';
import 'ai_providers.dart';

/// Same cap as the web recorder (use-voice-recording.ts).
const _maxRecording = Duration(seconds: 120);

enum _Phase { idle, recording, transcribing, composing }

/// Speak an email or a question (web VoiceListeningOverlay + "Speak your
/// mind"): record → server transcription → either polished drafts for the
/// composer or a new assistant chat.
class VoiceComposeScreen extends ConsumerStatefulWidget {
  const VoiceComposeScreen({super.key});

  @override
  ConsumerState<VoiceComposeScreen> createState() => _VoiceComposeScreenState();
}

class _VoiceComposeScreenState extends ConsumerState<VoiceComposeScreen> {
  final _recorder = AudioRecorder();
  final _transcript = TextEditingController();
  _Phase _phase = _Phase.idle;
  Duration _elapsed = Duration.zero;
  Timer? _ticker;
  String? _path;
  List<AiReplyDraft>? _drafts;
  int _selected = 0;

  @override
  void dispose() {
    _ticker?.cancel();
    unawaited(_recorder.dispose());
    _transcript.dispose();
    _deleteRecording();
    super.dispose();
  }

  void _deleteRecording() {
    final path = _path;
    _path = null;
    if (path != null) {
      try {
        File(path).deleteSync();
      } on FileSystemException {
        // Already gone.
      }
    }
  }

  Future<void> _start() async {
    if (!await _recorder.hasPermission()) {
      if (mounted) showMessage(context, 'Microphone permission is needed to record.', error: true);
      return;
    }
    final dir = await getTemporaryDirectory();
    _path = '${dir.path}/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
    await _recorder.start(
      const RecordConfig(numChannels: 1, bitRate: 64000),
      path: _path!,
    );
    setState(() {
      _phase = _Phase.recording;
      _elapsed = Duration.zero;
      _drafts = null;
    });
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() => _elapsed += const Duration(seconds: 1));
      if (_elapsed >= _maxRecording) unawaited(_stop());
    });
  }

  Future<void> _stop() async {
    _ticker?.cancel();
    final path = await _recorder.stop();
    if (path == null) {
      setState(() => _phase = _Phase.idle);
      return;
    }
    setState(() => _phase = _Phase.transcribing);
    try {
      final bytes = await File(path).readAsBytes();
      final text = await ref.read(aiServiceProvider).transcribe(bytes, mediaType: 'audio/mp4');
      if (!mounted) return;
      if (text.trim().isEmpty) {
        showMessage(context, "We couldn't hear anything. Try again.", error: true);
      } else {
        _transcript.text = text.trim();
      }
    } on Exception catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    } finally {
      _deleteRecording();
      if (mounted) setState(() => _phase = _Phase.idle);
    }
  }

  Future<void> _compose() async {
    final text = _transcript.text.trim();
    if (text.isEmpty) return;
    setState(() => _phase = _Phase.composing);
    try {
      final drafts = await ref.read(aiServiceProvider).composeFromTranscript(text);
      setState(() {
        _drafts = drafts;
        _selected = 0;
      });
    } on Exception catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _phase = _Phase.idle);
    }
  }

  Future<void> _askAssistant() async {
    final text = _transcript.text.trim();
    final mailbox = ref.read(selectedMailboxProvider);
    if (text.isEmpty || mailbox == null) return;
    try {
      final convo = await ref.read(aiServiceProvider).createConversation(mailbox.id);
      ref.invalidate(conversationsProvider(mailbox.id));
      if (mounted) await context.push(Routes.aiChatPath(convo.id, isNew: true), extra: text);
    } on Exception {
      if (mounted) showMessage(context, "Couldn't start a new chat", error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final busy = _phase == _Phase.transcribing || _phase == _Phase.composing;
    final recording = _phase == _Phase.recording;
    final drafts = _drafts;
    final remaining = _maxRecording - _elapsed;

    return Scaffold(
      appBar: AppBar(title: const Text('Voice compose')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const SizedBox(height: 16),
          Center(
            child: SizedBox.square(
              dimension: 120,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  shape: const CircleBorder(),
                  backgroundColor: recording ? theme.colorScheme.error : null,
                ),
                onPressed: busy ? null : (recording ? _stop : _start),
                child: busy
                    ? const CircularProgressIndicator()
                    : Icon(
                        recording ? Icons.stop : Icons.mic,
                        size: 48,
                        semanticLabel: recording ? 'Stop recording' : 'Start recording',
                      ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            switch (_phase) {
              _Phase.recording => 'Listening… ${remaining.inSeconds}s left',
              _Phase.transcribing => 'Transcribing…',
              _Phase.composing => 'Writing your email…',
              _Phase.idle => 'Tap to speak. Say what you want to write or ask.',
            },
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          TextField(
            controller: _transcript,
            minLines: 3,
            maxLines: 8,
            enabled: !busy && !recording,
            decoration: const InputDecoration(labelText: 'Transcript', alignLabelWithHint: true),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: busy || recording || _transcript.text.trim().isEmpty ? null : _askAssistant,
                  icon: const Icon(Icons.chat_bubble_outline),
                  label: const Text('Ask assistant'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed: busy || recording || _transcript.text.trim().isEmpty ? null : _compose,
                  icon: const Icon(Icons.edit_outlined),
                  label: const Text('Write email'),
                ),
              ),
            ],
          ),
          if (drafts != null && drafts.isNotEmpty) ...[
            const SizedBox(height: 24),
            SegmentedButton<int>(
              segments: [
                for (var i = 0; i < drafts.length; i++)
                  ButtonSegment(value: i, label: Text(_capitalize(drafts[i].tone))),
              ],
              selected: {_selected},
              onSelectionChanged: (s) => setState(() => _selected = s.first),
            ),
            const SizedBox(height: 12),
            Card(
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(drafts[_selected].subject, style: theme.textTheme.titleSmall),
                    const SizedBox(height: 8),
                    SelectableText(drafts[_selected].body),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: () => context.push(
                Routes.compose,
                extra: ComposeArgs(subject: drafts[_selected].subject, body: drafts[_selected].body),
              ),
              icon: const Icon(Icons.send_outlined),
              label: const Text('Open in composer'),
            ),
          ],
        ],
      ),
    );
  }

  static String _capitalize(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}
