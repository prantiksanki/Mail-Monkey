import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// A recorded request.
class RecordedRequest {
  RecordedRequest(this.options, this.body);

  final RequestOptions options;
  final Object? body;

  String get method => options.method;
  String get path => options.path;
  Map<String, dynamic> get query => options.queryParameters;
  String? get authorization => options.headers['Authorization'] as String?;
}

typedef FakeHandler = FakeResponse Function(RecordedRequest request);

class FakeResponse {
  const FakeResponse(this.status, [this.body]);

  final int status;
  final Object? body;
}

/// Dio adapter that answers from [handler] instead of the network, so API
/// tests use controlled responses.
class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.handler);

  final FakeHandler handler;
  final List<RecordedRequest> requests = [];
  Object? throwOnFetch;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (throwOnFetch != null) {
      throw DioException.connectionError(requestOptions: options, reason: 'offline');
    }
    final recorded = RecordedRequest(options, options.data);
    requests.add(recorded);
    final response = handler(recorded);
    return ResponseBody.fromString(
      jsonEncode(response.body),
      response.status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Dio fakeDio(FakeAdapter adapter, {String baseUrl = 'http://test/api'}) =>
    Dio(BaseOptions(baseUrl: baseUrl, responseType: ResponseType.json))
      ..httpClientAdapter = adapter;
