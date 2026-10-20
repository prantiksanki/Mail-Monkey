import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/widgets/brand_logo.dart';
import '../../shared/widgets/state_views.dart';
import 'auth_controller.dart';
import 'data/auth_repository.dart';

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  SignInProvider? _busy;

  Future<void> _signIn(SignInProvider provider) async {
    setState(() => _busy = provider);
    try {
      await ref.read(authControllerProvider.notifier).signIn(provider);
    } on AuthException catch (e) {
      if (mounted && e.code != 'cancelled') {
        showMessage(context, e.userMessage, error: true);
      }
    } catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const BrandLogo(height: 96),
                  const SizedBox(height: 40),
                  Text(
                    'Welcome back.',
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Your rules have been running quietly while you were gone.',
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 32),
                  FilledButton.icon(
                    onPressed: _busy == null
                        ? () => _signIn(SignInProvider.google)
                        : null,
                    icon: _busy == SignInProvider.google
                        ? const _Spinner()
                        : const Icon(Icons.g_mobiledata, size: 28),
                    label: const Text('Continue with Google'),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _busy == null
                        ? () => _signIn(SignInProvider.microsoft)
                        : null,
                    icon: _busy == SignInProvider.microsoft
                        ? const _Spinner()
                        : const Icon(Icons.window_outlined),
                    label: const Text('Continue with Microsoft'),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Sign-in opens in your browser so your Google or Microsoft '
                    'password is never shared with the app.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Spinner extends StatelessWidget {
  const _Spinner();

  @override
  Widget build(BuildContext context) => const SizedBox(
    width: 20,
    height: 20,
    child: CircularProgressIndicator(strokeWidth: 2),
  );
}
