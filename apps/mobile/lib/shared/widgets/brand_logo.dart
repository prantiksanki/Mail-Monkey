import 'package:flutter/material.dart';

/// Full Mail Monkey logo; uses the light-text variant on dark themes
/// (same assets as the web's Logo component).
class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.height = 56});

  final double height;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Image.asset(
      isDark ? 'assets/brand/logo-dark.png' : 'assets/brand/logo.png',
      height: height,
      fit: BoxFit.contain,
      semanticLabel: 'Mail Monkey',
    );
  }
}

/// Square mascot mark for compact spots (app bar, drawer header).
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 32});

  final double size;

  @override
  Widget build(BuildContext context) => Image.asset(
    'assets/brand/icon.png',
    width: size,
    height: size,
    semanticLabel: 'Mail Monkey',
  );
}
