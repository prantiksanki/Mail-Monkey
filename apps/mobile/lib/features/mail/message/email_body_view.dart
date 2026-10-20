import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'email_html.dart';

/// Sandboxed email body: JavaScript off, sanitized HTML, and every link
/// opened outside the app.
class EmailBodyView extends StatefulWidget {
  const EmailBodyView({super.key, required this.bodyHtml, required this.bodyText});

  final String bodyHtml;
  final String bodyText;

  @override
  State<EmailBodyView> createState() => EmailBodyViewViewState();
}

class EmailBodyViewViewState extends State<EmailBodyView> {
  late final WebViewController _controller;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.disabled)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) {
            final uri = Uri.tryParse(request.url);
            if (uri == null || request.url.startsWith('about:') || request.url.startsWith('data:')) {
              return NavigationDecision.navigate;
            }
            if (const {'http', 'https', 'mailto', 'tel'}.contains(uri.scheme)) {
              unawaited(launchUrl(uri, mode: LaunchMode.externalApplication));
            }
            return NavigationDecision.prevent;
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _loaded = true);
          },
        ),
      );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    unawaited(
      _controller.loadHtmlString(
        buildEmailDocument(
          bodyHtml: widget.bodyHtml,
          bodyText: widget.bodyText,
          dark: Theme.of(context).brightness == Brightness.dark &&
              widget.bodyHtml.trim().isEmpty,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      WebViewWidget(controller: _controller),
      if (!_loaded) const LinearProgressIndicator(),
    ],
  );
}
