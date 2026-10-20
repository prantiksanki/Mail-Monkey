import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../models/session.dart';
import 'data/auth_repository.dart';

/// Signed-in session (null = signed out). Loading while the stored token is
/// validated at startup.
final authControllerProvider =
    AsyncNotifierProvider<AuthController, AppSession?>(AuthController.new);

class AuthController extends AsyncNotifier<AppSession?> {
  AuthRepository get _repo => ref.read(authRepositoryProvider);

  @override
  Future<AppSession?> build() async {
    // Any 401 from the API means the session is gone server-side.
    ref.read(apiClientProvider).onUnauthorized = _handleUnauthorized;
    return _repo.currentSession();
  }

  Future<void> signIn(SignInProvider provider) async {
    final previous = state.value;
    state = const AsyncLoading();
    try {
      state = AsyncData(await _repo.signIn(provider));
    } catch (e, st) {
      state = AsyncError(e, st);
      // Keep the previous signed-out/in state recoverable for the UI.
      if (previous != null) state = AsyncData(previous);
      rethrow;
    }
  }

  /// Re-reads the session (e.g. after onboarding or a profile change).
  Future<void> refresh() async {
    state = AsyncData(await _repo.currentSession());
  }

  Future<void> signOut() async {
    await _repo.signOut();
    state = const AsyncData(null);
  }

  void _handleUnauthorized() {
    if (state.value != null) {
      ref.read(tokenStoreProvider).clear();
      state = const AsyncData(null);
    }
  }
}
