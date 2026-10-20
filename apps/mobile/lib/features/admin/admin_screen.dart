import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/env.dart';
import '../../shared/utils/format.dart';
import '../../shared/widgets/app_drawer.dart';
import '../../shared/widgets/state_views.dart';
import '../settings/settings_providers.dart';

const _pageSize = 25;

/// Admin (web /app/admin): searchable users and organizations. Visible only
/// to admins; the server enforces the role on every request.
class AdminScreen extends StatelessWidget {
  const AdminScreen({super.key, this.initialTab = 0});

  final int initialTab;

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 2,
    initialIndex: initialTab,
    child: Scaffold(
      drawer: const AppDrawer(selected: 'admin'),
      appBar: AppBar(
        title: const Text('Admin'),
        bottom: const TabBar(tabs: [Tab(text: 'Users'), Tab(text: 'Organizations')]),
      ),
      body: const TabBarView(children: [_AdminList(users: true), _AdminList(users: false)]),
    ),
  );
}

class _AdminList extends ConsumerStatefulWidget {
  const _AdminList({required this.users});

  final bool users;

  @override
  ConsumerState<_AdminList> createState() => _AdminListState();
}

class _AdminListState extends ConsumerState<_AdminList> with AutomaticKeepAliveClientMixin {
  final _search = TextEditingController();
  Timer? _debounce;
  final List<Widget> _rows = [];
  int _total = 0;
  bool _loading = false;
  Object? _error;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    unawaited(_load(reset: true));
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load({required bool reset}) async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
      if (reset) _rows.clear();
    });
    final admin = ref.read(adminServiceProvider);
    final query = _search.text.trim().isEmpty ? null : _search.text.trim();
    try {
      if (widget.users) {
        final page = await admin.users(query: query, limit: _pageSize, offset: _rows.length);
        _total = page.total;
        _rows.addAll([
          for (final u in page.users)
            ListTile(
              leading: CircleAvatar(
                backgroundImage: Env.imageUrl(u.image) == null ? null : NetworkImage(Env.imageUrl(u.image)!),
                child: u.image == null ? Text(u.name.isEmpty ? '?' : u.name[0].toUpperCase()) : null,
              ),
              title: Text(u.name.isEmpty ? u.email : u.name),
              subtitle: Text(
                [
                  u.email,
                  if (u.role == 'admin') 'Admin',
                  if (u.accountType != 'STANDARD') u.accountType.toLowerCase(),
                  if (u.banned) 'Banned',
                  if (!u.emailVerified) 'Unverified',
                ].join(' · '),
              ),
              trailing: Text(formatListDate(u.createdAt)),
            ),
        ]);
      } else {
        final page = await admin.organizations(query: query, limit: _pageSize, offset: _rows.length);
        _total = page.total;
        _rows.addAll([
          for (final o in page.organizations)
            ListTile(
              leading: const CircleAvatar(child: Icon(Icons.business)),
              title: Text(o.name),
              subtitle: Text('${o.membersCount} member${o.membersCount == 1 ? '' : 's'}${o.slug == null ? '' : ' · ${o.slug}'}'),
              trailing: Text(formatListDate(o.createdAt)),
            ),
        ]);
      }
    } on Exception catch (e) {
      _error = e;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            controller: _search,
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search),
              hintText: widget.users ? 'Search users' : 'Search organizations',
              isDense: true,
            ),
            onChanged: (_) {
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 350), () => _load(reset: true));
            },
          ),
        ),
        Expanded(
          child: _error != null && _rows.isEmpty
              ? ErrorView(error: _error!, onRetry: () => _load(reset: true))
              : RefreshIndicator(
                  onRefresh: () => _load(reset: true),
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      if (!_loading && _rows.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(top: 48),
                          child: EmptyView(icon: Icons.search_off, title: 'Nothing found'),
                        ),
                      ..._rows,
                      if (_loading)
                        const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()))
                      else if (_rows.length < _total)
                        TextButton(onPressed: () => _load(reset: false), child: const Text('Load more')),
                    ],
                  ),
                ),
        ),
      ],
    );
  }
}
