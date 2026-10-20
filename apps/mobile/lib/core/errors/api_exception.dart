/// Error raised by the API layer. Mirrors the backend's oRPC error shape
/// (`{ code, status, message }`) plus client-side network failures.
class ApiException implements Exception {
  const ApiException({
    required this.code,
    required this.message,
    this.status,
  });

  /// Backend error code (e.g. `UNAUTHORIZED`, `TOO_MANY_REQUESTS`) or one of
  /// the client codes below.
  final String code;
  final String message;
  final int? status;

  static const network = 'NETWORK_ERROR';
  static const timeout = 'TIMEOUT';
  static const unknown = 'UNKNOWN';

  bool get isUnauthorized => code == 'UNAUTHORIZED' || status == 401;
  bool get isRateLimited => code == 'TOO_MANY_REQUESTS' || status == 429;
  bool get isNotFound => code == 'NOT_FOUND' || status == 404;
  bool get isNetwork => code == network || code == timeout;
  bool get isValidation =>
      code == 'BAD_REQUEST' || status == 400 || status == 422;

  /// Message suitable for showing to the user.
  String get userMessage {
    if (isNetwork) {
      return 'Can\'t reach Mail Monkey. Check your connection and try again.';
    }
    if (isRateLimited) {
      return message.isNotEmpty
          ? message
          : 'Too many requests — please wait a moment and try again.';
    }
    if (status != null && status! >= 500) {
      return 'Something went wrong on our side. Please try again.';
    }
    return message.isNotEmpty ? message : 'Something went wrong.';
  }

  @override
  String toString() => 'ApiException($code, $status): $message';
}
