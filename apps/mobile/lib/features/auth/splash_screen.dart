import 'package:flutter/material.dart';

import '../../shared/widgets/brand_logo.dart';

/// Shown while the stored session is validated at startup.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) => const Scaffold(
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          BrandLogo(height: 88),
          SizedBox(height: 32),
          SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(strokeWidth: 2.5),
          ),
        ],
      ),
    ),
  );
}
