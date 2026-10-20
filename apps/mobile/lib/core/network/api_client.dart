import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';

import '../config/env.dart';
import '../errors/api_exception.dart';
import '../security/token_store.dart';

/// One Server-Sent Event (`event:` name and `data:` payload).
class SseEvent {
  const SseEvent(this.event, this.data);

  final String event;
  final String data;
}

/// Typed access to the Mail Monkey REST API (`/api/*`, the OpenAPI side of
/// the backend's oRPC router). Every request carries the session token as
/// `Authorization: Bearer …` when signed in.
class ApiClient {
  ApiClient({
    required this._tokenStore,
    Dio? dio,
    String baseUrl = Env.apiBaseUrl,
    this.onUnauthorized,
  }) : _dio =
           dio ??
           Dio(
             BaseOptions(
               baseUrl: '$baseUrl/api',
               connectTimeout: const Duration(seconds: 15),
               receiveTimeout: const Duration(seconds: 60),
               responseType: ResponseType.json,
               headers: {'Accept': 'application/json'},
             ),
           ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _tokenStore.read();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  final TokenStore _tokenStore;
  final Dio _dio;

  /// Called when a signed-in request is rejected with 401 (expired/revoked
  /// session), so the app can return to the sign-in screen.
  void Function()? onUnauthorized;

  Dio get dio => _dio;

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) =>
      _send(() => _dio.get<dynamic>(path, queryParameters: _clean(query)));

  Future<dynamic> post(String path, {Object? body}) =>
      _send(() => _dio.post<dynamic>(path, data: body ?? const {}));

  Future<dynamic> put(String path, {Object? body}) =>
      _send(() => _dio.put<dynamic>(path, data: body ?? const {}));

  Future<dynamic> patch(String path, {Object? body}) =>
      _send(() => _dio.patch<dynamic>(path, data: body ?? const {}));

  Future<dynamic> delete(String path, {Object? body}) =>
      _send(() => _dio.delete<dynamic>(path, data: body));

  /// Server-Sent Events stream (e.g. `/mailboxes/{id}/inbox/events`). Yields
  /// the `data:` payload of each event; comment/keepalive lines are skipped.
  Stream<String> sse(String path) => _events(
    () => _dio.get<ResponseBody>(path, options: _streamOptions),
  ).where((e) => e.data.isNotEmpty).map((e) => e.data);

  /// POST that answers with an event stream — how oRPC serves streaming
  /// procedures (e.g. the AI assistants): `event: message` per chunk,
  /// `event: done` at the end, `event: error` on failure.
  Stream<SseEvent> postSse(String path, {Object? body, CancelToken? cancelToken}) => _events(
    () => _dio.post<ResponseBody>(
      path,
      data: body ?? const {},
      options: _streamOptions,
      cancelToken: cancelToken,
    ),
  );

  static final _streamOptions = Options(
    responseType: ResponseType.stream,
    receiveTimeout: Duration.zero,
    headers: {'Accept': 'text/event-stream'},
  );

  Stream<SseEvent> _events(Future<Response<ResponseBody>> Function() open) async* {
    final Response<ResponseBody> response;
    try {
      response = await open();
    } on DioException catch (e) {
      final error = await _toApiExceptionFromStream(e);
      if (error.isUnauthorized) onUnauthorized?.call();
      throw error;
    }
    final lines = response.data!.stream
        .cast<List<int>>()
        .transform(utf8.decoder)
        .transform(const LineSplitter());
    final data = StringBuffer();
    String? event;
    await for (final line in lines) {
      if (line.isEmpty) {
        if (data.isNotEmpty || event != null) {
          yield SseEvent(event ?? 'message', data.toString());
          data.clear();
          event = null;
        }
      } else if (line.startsWith('event:')) {
        event = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        if (data.isNotEmpty) data.write('\n');
        data.write(line.substring(5).trimLeft());
      }
    }
    if (data.isNotEmpty) yield SseEvent(event ?? 'message', data.toString());
  }

  /// Streaming responses carry error bodies as a byte stream; read it so the
  /// backend's error code/message still reaches the caller.
  static Future<ApiException> _toApiExceptionFromStream(DioException e) async {
    final body = e.response?.data;
    if (body is ResponseBody) {
      try {
        final text = await utf8.decodeStream(body.stream.cast<List<int>>());
        final decoded = jsonDecode(text);
        return _toApiException(
          DioException(
            requestOptions: e.requestOptions,
            response: Response(
              requestOptions: e.requestOptions,
              statusCode: e.response?.statusCode,
              data: decoded,
            ),
            type: e.type,
          ),
        );
      } catch (_) {
        // Fall through to the status-only mapping.
      }
    }
    return _toApiException(e);
  }

  Future<dynamic> _send(Future<Response<dynamic>> Function() request) async {
    try {
      final response = await request();
      return response.data;
    } on DioException catch (e) {
      final error = _toApiException(e);
      if (error.isUnauthorized) onUnauthorized?.call();
      throw error;
    }
  }

  static Map<String, dynamic>? _clean(Map<String, dynamic>? query) {
    if (query == null) return null;
    return {
      for (final entry in query.entries)
        if (entry.value != null && entry.value != '') entry.key: entry.value,
    };
  }

  static ApiException _toApiException(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const ApiException(
          code: ApiException.timeout,
          message: 'The request timed out.',
        );
      case DioExceptionType.connectionError:
        return const ApiException(
          code: ApiException.network,
          message: 'Network error.',
        );
      default:
        break;
    }
    final status = e.response?.statusCode;
    final data = e.response?.data;
    if (data is Map) {
      final code = data['code'];
      final message = data['message'] ?? data['error'];
      return ApiException(
        code: code is String ? code : _codeForStatus(status),
        message: message is String ? message : '',
        status: status,
      );
    }
    return ApiException(
      code: _codeForStatus(status),
      message: e.message ?? '',
      status: status,
    );
  }

  static String _codeForStatus(int? status) => switch (status) {
    400 => 'BAD_REQUEST',
    401 => 'UNAUTHORIZED',
    403 => 'FORBIDDEN',
    404 => 'NOT_FOUND',
    429 => 'TOO_MANY_REQUESTS',
    null => ApiException.network,
    _ => status >= 500 ? 'INTERNAL_SERVER_ERROR' : ApiException.unknown,
  };
}
