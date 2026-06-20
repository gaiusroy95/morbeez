import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewProps,
} from 'react-native';
import { isNetworkFailureMessage, formatAppError, tokens, t, type AppLocale, APP_LOCALES, LOCALE_LABELS } from '@morbeez/shared';
import { useNetwork } from './NetworkProvider';
import { HeaderMorbeezLogo } from './MorbeezLogo';
import { androidPressHandlers } from './mobile-nav';

export { MorbeezLogo, HeaderMorbeezLogo, BrandedHeaderTitle, MORBEEZ_HEADER_LOGO_HEIGHT } from './MorbeezLogo';
export { stableRowKey, dedupeBy } from '@morbeez/shared';
export {
  androidPressHandlers,
  ANDROID_NAV_BAR_MIN,
  HeaderPressable,
  ScrollableHubTabs,
  StickyScreenFooter,
  useDeviceBottomInset,
  useMobileTabBarStyle,
  useMobileTabScreenOptions,
  useStickyFooterPadding,
  useStickyFooterScrollPadding,
} from './mobile-nav';
export { KeyboardAwareScrollScreen } from './KeyboardAwareScrollScreen';
import { KeyboardAwareScrollScreen } from './KeyboardAwareScrollScreen';
export {
  ScrollableUnderlineTabs,
  BlockSummaryCard,
  ActivityTimeline,
  SoilTestsPanel,
  FieldFindingsPanel,
  BlockRecommendationsPanel,
  cropEmoji,
  activityIcon,
  activityTypeTitle,
  activityDap,
} from './block-detail-panels';
export { DynamicSelect, type DynamicSelectOption } from './DynamicSelect';
export { NetworkProvider, OfflineBanner, useNetwork, useOnReconnect, useAppError } from './NetworkProvider';
export {
  HealthBadge,
  FieldCard,
  BlockCard,
  AlertCard,
  SectionHeader,
  StarRating,
  ProductCard,
  QuickActionGrid,
  CropMarketSelectors,
  HomeHeroCard,
  MarketAnalyticsPanel,
  WeatherAlertBanner,
  HomeQuickActions,
  MarketRateCard,
  FinanceSummaryRow,
  TaskCard,
  PromoBanner,
  OrderStatusChip,
  DonutChart,
  RoiFilterPickers,
  RoiStatCards,
  RoiCropStatusCard,
  RoiHarvestGrid,
  RoiQuickActionsRow,
  StageProgressBar,
} from './farmer-ui';

/** Green app bar with Morbeez logo on the left */
export function appHeaderScreenOptions(title?: string) {
  return {
    headerStyle: { backgroundColor: tokens.green800 },
    headerTintColor: '#fff' as const,
    headerTitle: title ?? '',
    headerTitleStyle: { fontWeight: '600' as const },
    headerLeft: () => <HeaderMorbeezLogo style={{ marginLeft: 12 }} />,
  };
}

export function Screen({ style, ...props }: ViewProps) {
  return <View style={[styles.screen, style]} {...props} />;
}

export function Panel({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.panel}>
      {title ? <Text style={styles.panelTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function Btn({
  label,
  onPress,
  variant = 'primary',
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        variant === 'secondary' && styles.btnSecondary,
        variant === 'danger' && styles.btnDanger,
        (pressed || disabled) && styles.btnPressed,
        disabled && styles.btnDisabled,
      ]}
      {...androidPressHandlers(onPress, disabled)}
    >
      <Text
        style={[
          styles.btnText,
          variant === 'secondary' && styles.btnTextSecondary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function AlertBox({ children }: { children: React.ReactNode }) {
  const { isOnline } = useNetwork();
  const text =
    typeof children === 'string' || typeof children === 'number'
      ? String(children).trim()
      : '';
  if (text && !isOnline && isNetworkFailureMessage(text)) return null;
  if (text && isNetworkFailureMessage(text)) {
    const friendly = formatAppError(new Error(text), isOnline);
    if (!friendly) return null;
    return (
      <View style={styles.alert}>
        <Text style={styles.alertText}>{friendly}</Text>
      </View>
    );
  }
  if (!children || (typeof children === 'string' && !children.trim())) return null;
  return (
    <View style={styles.alert}>
      <Text style={styles.alertText}>{children}</Text>
    </View>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={tokens.green700} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{children}</Text>
    </View>
  );
}

export function StatCard({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string | number;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable style={styles.statCard} {...androidPressHandlers(onPress)}>
        {content}
      </Pressable>
    );
  }
  return <View style={styles.statCard}>{content}</View>;
}

export function ListCard({
  title,
  subtitle,
  meta,
  onPress,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.listCard}>
      <View style={styles.listCardMain}>
        <Text style={styles.listCardTitle}>{title}</Text>
        {subtitle ? <Text style={styles.listCardSub}>{subtitle}</Text> : null}
      </View>
      {meta ? <Text style={styles.listCardMeta}>{meta}</Text> : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable {...androidPressHandlers(onPress)} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }
  return content;
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
    <View style={styles.tabs}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.id}
          hitSlop={4}
          {...androidPressHandlers(() => onChange(tab.id))}
          style={[styles.tab, active === tab.id && styles.tabActive]}
        >
          <Text style={[styles.tabText, active === tab.id && styles.tabTextActive]}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Language picker — farmer-friendly locale labels (en, hi, ml, ta, kn). */
export function LanguagePicker({
  locale,
  onChange,
}: {
  locale: AppLocale;
  onChange: (locale: AppLocale) => void;
}) {
  return (
    <View style={styles.langRow}>
      {APP_LOCALES.map((code) => (
        <Btn
          key={code}
          label={LOCALE_LABELS[code]}
          variant={locale === code ? 'primary' : 'secondary'}
          onPress={() => onChange(code)}
        />
      ))}
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

/** Shared min height for multiline / description-style inputs across mobile apps. */
export const MULTILINE_MIN_HEIGHT = 160;

const DESCRIPTION_LIKE_LABEL =
  /\b(description|notes?|remarks?|observations?|recommendations?|comments?|summar(y|ies)|details?|findings?|issues?|learning|diagnosis|feedback|instructions?)\b/i;

export function isDescriptionLikeLabel(label: string): boolean {
  return DESCRIPTION_LIKE_LABEL.test(label);
}

export function TextField({
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  placeholder,
  accessibilityLabel,
  maxLength,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric' | 'number-pad' | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  placeholder?: string;
  accessibilityLabel?: string;
  maxLength?: number;
  multiline?: boolean;
}) {
  const isMultiline = multiline ?? isDescriptionLikeLabel(label);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, isMultiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? (isMultiline ? 'sentences' : 'none')}
        placeholder={placeholder}
        placeholderTextColor={tokens.textMuted}
        accessibilityLabel={accessibilityLabel ?? label}
        maxLength={maxLength}
        multiline={isMultiline}
        textAlignVertical={isMultiline ? 'top' : 'auto'}
      />
    </View>
  );
}

export function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.passwordRow}>
        <TextInput
          style={styles.passwordInput}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          placeholder={placeholder}
          placeholderTextColor={tokens.textMuted}
          accessibilityLabel={accessibilityLabel ?? label}
        />
        <Pressable
          style={styles.eyeBtn}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          {...androidPressHandlers(() => setVisible((v) => !v))}
        >
          <Text style={styles.eyeText}>{visible ? '🙈' : '👁'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ChangePasswordForm({
  locale,
  hasPassword = true,
  onSubmit,
  onSuccess,
}: {
  locale: AppLocale;
  hasPassword?: boolean;
  onSubmit: (input: {
    currentPassword?: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<void>;
  onSuccess?: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setError('');
    setSuccess('');
    if (newPassword.length < 8) {
      setError(t('passwordMinLength', locale));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('passwordsMustMatch', locale));
      return;
    }
    if (hasPassword && !currentPassword.trim()) {
      setError(t('currentPasswordRequired', locale));
      return;
    }

    setBusy(true);
    try {
      await onSubmit({
        currentPassword: hasPassword ? currentPassword : undefined,
        newPassword,
        confirmPassword,
      });
      setSuccess(t('passwordChanged', locale));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('passwordMinLength', locale));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAwareScrollScreen contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Panel title={hasPassword ? t('changePassword', locale) : t('setPassword', locale)}>
        <Text style={{ fontSize: 13, color: tokens.textMuted, marginBottom: 12, lineHeight: 18 }}>
          {hasPassword ? t('changePasswordHint', locale) : t('setPasswordHint', locale)}
        </Text>
        {error ? <AlertBox>{error}</AlertBox> : null}
        {success ? (
          <Text style={{ color: tokens.green700, marginBottom: 12, fontSize: 14 }}>{success}</Text>
        ) : null}
        {hasPassword ? (
          <PasswordField
            label={t('currentPassword', locale)}
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
        ) : null}
        <PasswordField
          label={t('newPassword', locale)}
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <PasswordField
          label={t('confirmPassword', locale)}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <View style={{ marginTop: 8 }}>
          <Btn
            label={busy ? '…' : hasPassword ? t('changePassword', locale) : t('setPassword', locale)}
            onPress={() => void save()}
            disabled={busy}
          />
        </View>
      </Panel>
    </KeyboardAwareScrollScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.bg,
  },
  panel: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radius,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text,
    marginBottom: tokens.spacing.sm,
  },
  btn: {
    backgroundColor: tokens.green700,
    borderRadius: tokens.radiusSm,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.green500,
  },
  btnSecondary: {
    backgroundColor: tokens.card,
    borderWidth: 2,
    borderColor: tokens.green700,
  },
  btnDanger: {
    backgroundColor: tokens.danger,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  btnTextSecondary: {
    color: tokens.green800,
  },
  alert: {
    backgroundColor: tokens.dangerBg,
    borderRadius: tokens.radiusSm,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  alertText: {
    color: tokens.danger,
    fontSize: 14,
  },
  loading: {
    padding: tokens.spacing.lg,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: tokens.textMuted,
    fontSize: 14,
  },
  empty: {
    padding: tokens.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: tokens.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: tokens.spacing.md,
  },
  statLabel: {
    fontSize: 12,
    color: tokens.textMuted,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: tokens.green800,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  listCardMain: {
    flex: 1,
  },
  listCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.text,
  },
  listCardSub: {
    fontSize: 13,
    color: tokens.textMuted,
    marginTop: 2,
  },
  listCardMeta: {
    fontSize: 12,
    color: tokens.green700,
    fontWeight: '600',
    marginLeft: 8,
  },
  pressed: {
    opacity: 0.9,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: tokens.spacing.md,
  },
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  tabActive: {
    backgroundColor: tokens.green100,
    borderColor: tokens.green500,
  },
  tabText: {
    fontSize: 13,
    color: tokens.textMuted,
    fontWeight: '500',
  },
  tabTextActive: {
    color: tokens.green800,
    fontWeight: '600',
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  kvLabel: {
    fontSize: 13,
    color: tokens.textMuted,
  },
  kvValue: {
    fontSize: 13,
    color: tokens.text,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  field: {
    marginBottom: tokens.spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: tokens.text,
  },
  inputMultiline: {
    minHeight: MULTILINE_MIN_HEIGHT,
    paddingTop: 12,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: tokens.text,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  eyeText: {
    fontSize: 18,
  },
});
