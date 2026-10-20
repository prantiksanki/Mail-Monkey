import 'package:flutter/material.dart';

/// Mail Monkey design tokens, matching the web (tooling/tailwind/theme.css:
/// brand blue #0663DA, navy #00388F).
abstract final class Brand {
  static const blue = Color(0xFF0663DA);
  static const navy = Color(0xFF00388F);
  static const success = Color(0xFF1A7F37);
  static const warning = Color(0xFFB45309);
  static const danger = Color(0xFFDC2626);
}

abstract final class AppTheme {
  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final scheme = ColorScheme.fromSeed(
      seedColor: Brand.blue,
      brightness: brightness,
    ).copyWith(primary: brightness == Brightness.light ? Brand.blue : null);
    final isDark = brightness == Brightness.dark;

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: isDark ? const Color(0xFF0F1115) : Colors.white,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 1,
        backgroundColor: isDark ? const Color(0xFF0F1115) : Colors.white,
        foregroundColor: scheme.onSurface,
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      listTileTheme: const ListTileThemeData(minVerticalPadding: 10),
      snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
    );
  }
}
