import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { theme } from '@/lib/theme';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator size="large" color={theme.green} />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'info'; children: ReactNode }) {
  return (
    <View style={[styles.alert, tone === 'error' ? styles.alertError : styles.alertInfo]}>
      <Text style={[styles.alertText, tone === 'error' ? styles.alertTextError : styles.alertTextInfo]}>
        {children}
      </Text>
    </View>
  );
}

export function ReadOnlyBanner() {
  return (
    <View style={styles.readOnly}>
      <Text style={styles.readOnlyText}>Read-only access — you can view but not edit.</Text>
    </View>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{children}</Text>
    </View>
  );
}

export function Badge({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'active' | 'archived' | 'role';
}) {
  const toneStyle =
    tone === 'active'
      ? styles.badgeActive
      : tone === 'archived'
        ? styles.badgeArchived
        : tone === 'role'
          ? styles.badgeRole
          : styles.badgeDefault;
  return (
    <View style={[styles.badge, toneStyle]}>
      <Text style={styles.badgeText}>{children}</Text>
    </View>
  );
}

export function Btn({
  children,
  onPress,
  variant = 'primary',
  disabled,
  size = 'md',
}: {
  children: ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const variantStyle =
    variant === 'secondary'
      ? styles.btnSecondary
      : variant === 'danger'
        ? styles.btnDanger
        : styles.btnPrimary;
  return (
    <Pressable
      style={[styles.btn, variantStyle, size === 'sm' && styles.btnSm, disabled && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[
          styles.btnText,
          variant === 'secondary' ? styles.btnTextSecondary : styles.btnTextPrimary,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

export function HubTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: T; label: string }>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
      <View style={styles.tabsRow}>
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <Pressable
              key={tab.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => onChange(tab.id)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

export function PageShell({
  loading,
  loadingLabel,
  children,
}: {
  loading?: boolean;
  loadingLabel?: string;
  children?: ReactNode;
}) {
  if (loading) return <Loading label={loadingLabel} />;
  return <>{children}</>;
}

export function StatCard({
  label,
  value,
  trendPct,
  compare,
}: {
  label: string;
  value: string;
  trendPct: number;
  compare: string;
}) {
  const up = trendPct >= 0;
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={[styles.statTrend, up ? styles.trendUp : styles.trendDown]}>
        {up ? '+' : ''}
        {trendPct}% vs {compare}
      </Text>
    </View>
  );
}

export function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

export function ListCard({
  title,
  subtitle,
  meta,
  onPress,
  style,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const content = (
    <>
      <Text style={styles.listTitle}>{title}</Text>
      {subtitle ? <Text style={styles.listSubtitle}>{subtitle}</Text> : null}
      {meta ? <Text style={styles.listMeta}>{meta}</Text> : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable style={[styles.listCard, style]} onPress={onPress}>
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.listCard, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  loadingWrap: { paddingVertical: 32, alignItems: 'center', gap: 12 },
  loadingLabel: { color: theme.muted, fontSize: 14 },
  alert: { borderRadius: 10, padding: 12, marginBottom: 12 },
  alertError: { backgroundColor: theme.dangerBg, borderWidth: 1, borderColor: '#fecaca' },
  alertInfo: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  alertText: { fontSize: 14 },
  alertTextError: { color: theme.danger },
  alertTextInfo: { color: theme.info },
  readOnly: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  readOnlyText: { color: theme.warning, fontSize: 14 },
  panel: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eef2ef',
    ...theme.cardShadow,
  },
  panelTitle: { fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 12 },
  empty: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { color: theme.muted, fontSize: 14 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeDefault: { backgroundColor: '#f3f4f6' },
  badgeActive: { backgroundColor: '#dcfce7' },
  badgeArchived: { backgroundColor: '#fee2e2' },
  badgeRole: { backgroundColor: '#e0e7ff' },
  badgeText: { fontSize: 12, fontWeight: '600', color: theme.text },
  btn: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  btnSm: { paddingVertical: 8, paddingHorizontal: 12 },
  btnPrimary: { backgroundColor: theme.green },
  btnSecondary: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  btnDanger: { backgroundColor: theme.danger },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 14, fontWeight: '700' },
  btnTextPrimary: { color: '#fff' },
  btnTextSecondary: { color: theme.text },
  tabsScroll: { marginBottom: 12, maxHeight: 44 },
  tabsRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#eef2ef',
  },
  tabActive: { backgroundColor: theme.green },
  tabText: { fontSize: 13, fontWeight: '600', color: theme.muted },
  tabTextActive: { color: '#fff' },
  statCard: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eef2ef',
    marginBottom: 10,
    ...theme.cardShadow,
  },
  statLabel: { fontSize: 12, color: theme.muted, marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: '800', color: theme.text, marginBottom: 4 },
  statTrend: { fontSize: 11 },
  trendUp: { color: theme.greenLight },
  trendDown: { color: theme.danger },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  kvLabel: { color: theme.muted, fontSize: 14, flex: 1 },
  kvValue: { color: theme.text, fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right' },
  listCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eef2ef',
  },
  listTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
  listSubtitle: { fontSize: 13, color: theme.muted, marginTop: 4 },
  listMeta: { fontSize: 12, color: theme.green, marginTop: 6, fontWeight: '600' },
});
