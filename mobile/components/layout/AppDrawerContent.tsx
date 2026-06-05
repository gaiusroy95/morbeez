import { useAuth } from '@/context/AuthContext';
import { filterNav, isNavItemActive, type NavGroup, type NavItem } from '@/lib/console-nav';
import { initials, roleLabel } from '@/lib/format';
import { webPathToExpoRoute } from '@/lib/mobile-paths';
import { theme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type DrawerContentProps = {
  navigation: { closeDrawer: () => void };
};

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  dashboard: 'grid-outline',
  phone: 'call-outline',
  operations: 'settings-outline',
  ai: 'sparkles-outline',
  farmers: 'leaf-outline',
  users: 'people-outline',
  analytics: 'bar-chart-outline',
  products: 'cart-outline',
  settings: 'cog-outline',
};

function NavIcon({ name }: { name: string }) {
  return <Ionicons name={ICONS[name] ?? 'ellipse-outline'} size={18} color={theme.green} />;
}

function DrawerNavItem({
  item,
  active,
  onPress,
}: {
  item: NavItem;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.navItem, active && styles.navItemActive]} onPress={onPress}>
      <NavIcon name={item.icon} />
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
    </Pressable>
  );
}

function DrawerGroup({
  group,
  pathname,
  expanded,
  onToggle,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (path: string) => void;
}) {
  const childActive = group.children.some((c) => isNavItemActive(pathname, c.path));
  return (
    <View style={styles.group}>
      <Pressable style={styles.groupHeader} onPress={onToggle}>
        <NavIcon name={group.icon} />
        <Text style={[styles.groupLabel, childActive && styles.navLabelActive]}>{group.label}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.muted} />
      </Pressable>
      {expanded
        ? group.children.map((child) => (
            <DrawerNavItem
              key={child.id}
              item={child}
              active={isNavItemActive(pathname, child.path)}
              onPress={() => onNavigate(child.path)}
            />
          ))
        : null}
    </View>
  );
}

export function AppDrawerContent(props: DrawerContentProps) {
  const { modules, admin, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const nav = useMemo(() => filterNav(modules), [modules]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    telecaller: true,
    ops: true,
    intel: true,
    agro: true,
    more: true,
  });

  const displayName = admin?.fullName ?? admin?.email ?? '';
  const avatar = initials(displayName);

  function navigate(path: string) {
    router.push(webPathToExpoRoute(path));
    props.navigation.closeDrawer();
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left']}>
      <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.brandRow}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>M</Text>
        </View>
        <View style={styles.brandText}>
          <Text style={styles.brandTitle}>Morbeez</Text>
          <Text style={styles.brandSub}>Staff console</Text>
        </View>
      </View>

      <View style={styles.nav}>
        {nav.map((group) => {
          if ('items' in group) {
            return group.items.map((item) => (
              <DrawerNavItem
                key={item.id}
                item={item}
                active={isNavItemActive(pathname, item.path)}
                onPress={() => navigate(item.path)}
              />
            ));
          }
          return (
            <DrawerGroup
              key={group.id}
              group={group}
              pathname={pathname}
              expanded={expanded[group.id] ?? true}
              onToggle={() => setExpanded((s) => ({ ...s, [group.id]: !s[group.id] }))}
              onNavigate={navigate}
            />
          );
        })}
      </View>

      <View style={styles.footer}>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatar}</Text>
          </View>
          <View style={styles.userMeta}>
            <Text style={styles.userName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.userRole}>{roleLabel(admin?.role ?? '')}</Text>
          </View>
        </View>
        <Pressable
          style={styles.logoutBtn}
          onPress={() => {
            void logout();
            props.navigation.closeDrawer();
            router.replace('/(auth)/login');
          }}
        >
          <Ionicons name="log-out-outline" size={18} color={theme.danger} />
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.surface },
  scroll: { flexGrow: 1, paddingTop: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 8 },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  brandText: { flex: 1 },
  brandTitle: { fontSize: 18, fontWeight: '800', color: theme.green },
  brandSub: { fontSize: 12, color: theme.muted },
  nav: { paddingHorizontal: 8, flex: 1 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  navItemActive: { backgroundColor: '#e8f5e9' },
  navLabel: { fontSize: 15, color: theme.text, fontWeight: '500' },
  navLabelActive: { color: theme.green, fontWeight: '700' },
  group: { marginBottom: 4 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  groupLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.text },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#eef2ef',
    padding: 16,
    marginTop: 8,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  userMeta: { flex: 1 },
  userName: { fontSize: 14, fontWeight: '700', color: theme.text },
  userRole: { fontSize: 12, color: theme.muted },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  logoutText: { color: theme.danger, fontWeight: '600', fontSize: 14 },
});
