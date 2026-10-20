/// Small, null-safe readers for API JSON. The backend sends dates as ISO-8601
/// strings and may omit optional fields, so every reader has a safe default.
typedef JsonMap = Map<String, dynamic>;

JsonMap asMap(Object? value) =>
    value is Map ? value.cast<String, dynamic>() : <String, dynamic>{};

List<JsonMap> asMapList(Object? value) =>
    value is List ? value.map(asMap).toList() : const [];

String readString(JsonMap json, String key, [String fallback = '']) {
  final value = json[key];
  return value is String ? value : (value?.toString() ?? fallback);
}

String? readStringOrNull(JsonMap json, String key) {
  final value = json[key];
  if (value == null) return null;
  return value is String ? value : value.toString();
}

bool readBool(JsonMap json, String key, [bool fallback = false]) {
  final value = json[key];
  return value is bool ? value : fallback;
}

int readInt(JsonMap json, String key, [int fallback = 0]) {
  final value = json[key];
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

double readDouble(JsonMap json, String key, [double fallback = 0]) {
  final value = json[key];
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

DateTime? readDate(JsonMap json, String key) {
  final value = json[key];
  if (value is String) return DateTime.tryParse(value)?.toLocal();
  if (value is int) {
    return DateTime.fromMillisecondsSinceEpoch(value, isUtc: true).toLocal();
  }
  return null;
}

List<String> readStringList(JsonMap json, String key) {
  final value = json[key];
  return value is List ? value.whereType<String>().toList() : const [];
}
