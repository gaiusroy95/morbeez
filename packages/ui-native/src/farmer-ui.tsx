import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { tokens } from '@morbeez/shared';

const healthColors: Record<string, { bg: string; text: string }> = {
  stable: { bg: tokens.green100, text: tokens.green800 },
  monitor: { bg: tokens.warningBg, text: tokens.warning },
  alert: { bg: tokens.dangerBg, text: tokens.danger },
  critical: { bg: tokens.dangerBg, text: tokens.danger },
};

export function HealthBadge({ status, label }: { status: string; label: string }) {
  const colors = healthColors[status] ?? healthColors.stable;
  return (
    <View style={[styles.healthBadge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.healthBadgeText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

export function BlockCard({
  name,
  crop,
  acreage,
  dap,
  plantingDateLabel,
  statusLabel = 'Active',
  healthStatus = 'stable',
  onPress,
}: {
  name: string;
  crop: string;
  acreage: number | null;
  dap: number | null;
  plantingDateLabel?: string | null;
  statusLabel?: string;
  healthStatus?: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.blockCard}>
      <View style={styles.blockCardIcon}>
        <Text style={styles.blockCardEmoji}>🌱</Text>
      </View>
      <View style={styles.blockCardBody}>
        <View style={styles.fieldHeader}>
          <Text style={styles.fieldName}>{name}</Text>
          <HealthBadge status={healthStatus} label={statusLabel} />
        </View>
        <Text style={styles.blockDetailRow}>
          <Text style={styles.blockDetailLabel}>Crop </Text>
          <Text style={styles.blockDetailValue}>{crop}</Text>
        </Text>
        {acreage != null ? (
          <Text style={styles.blockDetailRow}>
            <Text style={styles.blockDetailLabel}>Area </Text>
            <Text style={styles.blockDetailValue}>{acreage} Acre</Text>
          </Text>
        ) : null}
        {plantingDateLabel ? (
          <Text style={styles.blockDetailRow}>
            <Text style={styles.blockDetailLabel}>Planting </Text>
            <Text style={styles.blockDetailValue}>{plantingDateLabel}</Text>
          </Text>
        ) : null}
        {dap != null ? (
          <Text style={styles.blockDetailRow}>
            <Text style={styles.blockDetailLabel}>DAP </Text>
            <Text style={styles.blockDetailValue}>{dap}</Text>
          </Text>
        ) : null}
      </View>
      {onPress ? <Text style={styles.blockChevron}>›</Text> : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.blockPressable, pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }
  return content;
}

/** @deprecated Use BlockCard */
export function FieldCard({
  name,
  crop,
  acreage,
  dap,
  healthStatus,
  healthLabel,
  lastActivity,
  currentAlert,
  onPress,
  plantingDateLabel,
}: {
  name: string;
  crop: string;
  acreage: number | null;
  dap: number | null;
  healthStatus: string;
  healthLabel: string;
  lastActivity?: string | null;
  currentAlert?: string | null;
  plantingDateLabel?: string | null;
  onPress?: () => void;
}) {
  return (
    <BlockCard
      name={name}
      crop={crop}
      acreage={acreage}
      dap={dap}
      plantingDateLabel={plantingDateLabel}
      statusLabel={healthLabel}
      healthStatus={healthStatus}
      onPress={onPress}
    />
  );
}

export function AlertCard({ message, meta, tone = 'info' }: { message: string; meta?: string; tone?: string }) {
  const bg = tone === 'warning' ? tokens.warningBg : tone === 'success' ? tokens.green100 : tokens.card;
  return (
    <View style={[styles.alertCard, { backgroundColor: bg }]}>
      <Text style={styles.alertMessage}>{message}</Text>
      {meta ? <Text style={styles.alertMeta}>{meta}</Text> : null}
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  const full = Math.round(rating);
  return (
    <Text style={{ color: tokens.warning, fontSize: size }}>
      {'★'.repeat(full)}
      {'☆'.repeat(Math.max(0, 5 - full))}
    </Text>
  );
}

export function ProductCard({
  title,
  price,
  imageUrl,
  rating,
  recommended,
  onPress,
}: {
  title: string;
  price: string;
  imageUrl?: string | null;
  rating?: number;
  recommended?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.productCard}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.productImage} />
      ) : (
        <View style={[styles.productImage, styles.productImagePh]} />
      )}
      {recommended ? <Text style={styles.recTag}>Recommended</Text> : null}
      <Text style={styles.productTitle} numberOfLines={2}>
        {title}
      </Text>
      {rating != null && rating > 0 ? <StarRating rating={rating} size={12} /> : null}
      <Text style={styles.productPrice}>{price}</Text>
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.productWrap, pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }
  return <View style={styles.productWrap}>{content}</View>;
}

export function QuickActionGrid({
  actions,
}: {
  actions: Array<{ id: string; label: string; onPress: () => void }>;
}) {
  return (
    <View style={styles.quickGrid}>
      {actions.map((a) => (
        <Pressable key={a.id} style={styles.quickBtn} onPress={a.onPress} accessibilityRole="button" accessibilityLabel={a.label}>
          <Text style={styles.quickBtnText}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function CropMarketSelectors({
  crops,
  markets,
  selectedCrop,
  selectedMarket,
  favoriteCrop,
  pendingCrop,
  pendingMarket,
  onSelectCrop,
  onSelectMarket,
  cropLabel,
  marketLabel,
}: {
  crops: Array<{ id: string; cropName: string; icon?: string | null }>;
  markets: string[];
  selectedCrop: string;
  selectedMarket: string | null;
  favoriteCrop?: string | null;
  pendingCrop?: string | null;
  pendingMarket?: string | null;
  onSelectCrop: (crop: string) => void;
  onSelectMarket: (market: string) => void;
  cropLabel: string;
  marketLabel: string;
}) {
  return (
    <View style={styles.selectorWrap}>
      <View style={styles.selectorRow}>
        <Text style={styles.selectorLabel}>{cropLabel}</Text>
        <View style={styles.selectorChips}>
          {crops.map((c) => {
            const active = c.cropName === selectedCrop;
            const pending = pendingCrop === c.cropName;
            return (
              <Pressable
                key={c.id}
                style={[
                  styles.selectorChip,
                  active && styles.selectorChipActive,
                  pending && styles.selectorChipPending,
                ]}
                onPress={() => onSelectCrop(c.cropName)}
                disabled={pending}
              >
                <Text style={[styles.selectorChipText, active && styles.selectorChipTextActive]}>
                  {c.icon ? `${c.icon} ` : '🌱 '}
                  {c.cropName.charAt(0).toUpperCase() + c.cropName.slice(1)}
                  {favoriteCrop === c.cropName ? ' ★' : ''}
                  {pending ? ' …' : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {markets.length ? (
        <View style={styles.selectorRow}>
          <Text style={styles.selectorLabel}>{marketLabel}</Text>
          <View style={styles.selectorChips}>
            {markets.map((m) => {
              const active = m === selectedMarket;
              const pending = pendingMarket === m;
              return (
                <Pressable
                  key={m}
                  style={[
                    styles.selectorChip,
                    active && styles.selectorChipActive,
                    pending && styles.selectorChipPending,
                  ]}
                  onPress={() => onSelectMarket(m)}
                  disabled={pending}
                >
                  <Text style={[styles.selectorChipText, active && styles.selectorChipTextActive]}>
                    📍 {m}
                    {pending ? ' …' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function HomeHeroCard({
  cropName,
  cropIcon,
  dap,
  cycleDays,
  stage,
  marketName,
  pricePerKg,
  rateLabel,
  priceUpdatedOn,
  pendingRateMessage,
  dailyChangePct,
  lastYearPrice,
  differenceInr,
  yoyPct,
  labels,
}: {
  cropName: string;
  cropIcon?: string | null;
  dap: number | null;
  cycleDays: number | null;
  stage: string;
  marketName: string;
  pricePerKg?: number | null;
  rateLabel?: string;
  priceUpdatedOn?: string | null;
  pendingRateMessage?: string | null;
  dailyChangePct?: number | null;
  lastYearPrice?: number | null;
  differenceInr?: number | null;
  yoyPct?: number | null;
  labels: {
    currentRate: string;
    lastYearSameDay: string;
    difference: string;
    yoyChange: string;
    dap: string;
  };
}) {
  const dapLabel =
    dap != null && cycleDays != null ? `DAP ${dap} / ${cycleDays}` : dap != null ? `DAP ${dap}` : labels.dap;
  const dailyTrend =
    dailyChangePct != null && dailyChangePct !== 0
      ? `${dailyChangePct > 0 ? '↑' : '↓'} ${Math.abs(dailyChangePct)}% from yesterday`
      : null;
  const showPrice = pricePerKg != null;

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroTop}>
        <View style={styles.heroCropCol}>
          <View style={styles.heroCropIcon}>
            <Text style={styles.heroCropEmoji}>{cropIcon ?? '🌿'}</Text>
          </View>
          <View style={styles.heroCropInfo}>
            <Text style={styles.heroCropName}>{cropName.toUpperCase()}</Text>
            <View style={styles.heroDapBadge}>
              <Text style={styles.heroDapText}>{dapLabel}</Text>
            </View>
            <Text style={styles.heroStage}>🌱 {stage}</Text>
          </View>
        </View>
        <View style={styles.heroPriceCol}>
          {pendingRateMessage ? (
            <>
              <Text style={styles.heroRateLabel}>{labels.currentRate}</Text>
              <Text style={styles.heroPendingRate}>{pendingRateMessage}</Text>
            </>
          ) : showPrice ? (
            <>
              <Text style={styles.heroRateLabel}>{rateLabel ?? labels.currentRate}</Text>
              <Text style={styles.heroPrice}>₹{pricePerKg}/kg</Text>
              {priceUpdatedOn ? <Text style={styles.heroUpdatedOn}>{priceUpdatedOn}</Text> : null}
              {dailyTrend ? <Text style={styles.heroDailyTrend}>{dailyTrend}</Text> : null}
            </>
          ) : null}
        </View>
      </View>
      {showPrice ? (
        <>
          <View style={styles.heroDivider} />
          <View style={styles.heroYoYRow}>
            <Text style={styles.heroYoYItem}>
              {labels.lastYearSameDay}: {lastYearPrice != null ? `₹${lastYearPrice}/kg` : '—'}
            </Text>
            <Text style={[styles.heroYoYItem, styles.heroYoYPos]}>
              {labels.difference}: {differenceInr != null ? `${differenceInr >= 0 ? '+' : ''}₹${differenceInr}/kg` : '—'}
            </Text>
            <Text style={[styles.heroYoYItem, styles.heroYoYPos]}>
              {labels.yoyChange}: {yoyPct != null ? `${yoyPct >= 0 ? '+' : ''}${yoyPct}%` : '—'}
            </Text>
          </View>
        </>
      ) : null}
      <Text style={styles.heroMarketMeta}>{marketName}</Text>
    </View>
  );
}

export function MarketAnalyticsPanel({
  title,
  ranges,
  activeRange,
  onRangeChange,
  showCurrentYear,
  showLastYear,
  onToggleCurrentYear,
  onToggleLastYear,
  currentYearLabel,
  lastYearLabel,
  chart,
}: {
  title: string;
  ranges: Array<{ id: string; label: string }>;
  activeRange: string;
  onRangeChange: (id: string) => void;
  showCurrentYear: boolean;
  showLastYear: boolean;
  onToggleCurrentYear: () => void;
  onToggleLastYear: () => void;
  currentYearLabel: string;
  lastYearLabel: string;
  chart: ReactNode;
}) {
  return (
    <View style={styles.analyticsPanel}>
      <View style={styles.analyticsHeader}>
        <Text style={styles.analyticsTitle}>{title}</Text>
        <View style={styles.rangePills}>
          {ranges.map((r) => (
            <Pressable
              key={r.id}
              style={[styles.rangePill, activeRange === r.id && styles.rangePillActive]}
              onPress={() => onRangeChange(r.id)}
            >
              <Text style={[styles.rangePillText, activeRange === r.id && styles.rangePillTextActive]}>
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.toggleRow}>
        <Pressable style={styles.toggleChip} onPress={onToggleCurrentYear}>
          <Text style={[styles.toggleText, showCurrentYear && styles.toggleTextActive]}>● {currentYearLabel}</Text>
        </Pressable>
        <Pressable style={styles.toggleChip} onPress={onToggleLastYear}>
          <Text style={[styles.toggleText, showLastYear && styles.toggleTextMutedActive]}>● {lastYearLabel}</Text>
        </Pressable>
      </View>
      {chart}
    </View>
  );
}

export function WeatherAlertBanner({
  message,
  actionLabel,
  onPress,
}: {
  message: string;
  actionLabel: string;
  onPress?: () => void;
}) {
  const inner = (
    <View style={styles.weatherBanner}>
      <Text style={styles.weatherIcon}>⚠</Text>
      <Text style={styles.weatherMessage} numberOfLines={2}>
        {message}
      </Text>
      {onPress ? <Text style={styles.weatherAction}>{actionLabel} ›</Text> : null}
    </View>
  );
  if (onPress) {
    return <Pressable onPress={onPress}>{inner}</Pressable>;
  }
  return inner;
}

export function HomeQuickActions({
  title,
  actions,
}: {
  title: string;
  actions: Array<{
    id: string;
    label: string;
    subtitle: string;
    icon: string;
    onPress: () => void;
  }>;
}) {
  return (
    <View style={styles.homeQuickWrap}>
      <Text style={styles.homeQuickTitle}>{title}</Text>
      <View style={styles.homeQuickRow}>
        {actions.map((a) => (
          <Pressable key={a.id} style={styles.homeQuickCard} onPress={a.onPress}>
            <Text style={styles.homeQuickIcon}>{a.icon}</Text>
            <Text style={styles.homeQuickLabel}>{a.label}</Text>
            <Text style={styles.homeQuickSub} numberOfLines={2}>
              {a.subtitle}
            </Text>
            <Text style={styles.homeQuickChevron}>›</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function MarketRateCard({
  crop,
  marketName,
  pricePerKg,
  rateLabel,
  priceUpdatedOn,
  pendingRateMessage,
  trend,
  dailyChangeInr,
  onPress,
}: {
  crop: string;
  marketName: string;
  pricePerKg?: number | null;
  rateLabel?: string;
  priceUpdatedOn?: string | null;
  pendingRateMessage?: string | null;
  trend?: 'up' | 'down' | 'flat' | null;
  dailyChangeInr?: number | null;
  onPress?: () => void;
}) {
  const arrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendColor = trend === 'up' ? tokens.green700 : trend === 'down' ? tokens.danger : tokens.textMuted;
  const changeLabel =
    dailyChangeInr != null && dailyChangeInr !== 0
      ? `${dailyChangeInr > 0 ? '↑' : '↓'} ₹${Math.abs(Math.round(dailyChangeInr))} Today`
      : null;
  const inner = (
    <View style={styles.marketCard}>
      <Text style={styles.marketCrop}>{crop}</Text>
      <Text style={styles.marketName}>{marketName}</Text>
      {pendingRateMessage ? (
        <Text style={styles.marketPending}>{pendingRateMessage}</Text>
      ) : pricePerKg != null ? (
        <>
          {rateLabel ? <Text style={styles.marketRateLabel}>{rateLabel}</Text> : null}
          <View style={styles.marketPriceRow}>
            <Text style={styles.marketPrice}>₹{pricePerKg}/kg</Text>
            {trend ? <Text style={[styles.marketTrend, { color: trendColor }]}>{arrow}</Text> : null}
          </View>
          {priceUpdatedOn ? <Text style={styles.marketUpdatedOn}>{priceUpdatedOn}</Text> : null}
          {changeLabel ? <Text style={[styles.marketChange, { color: trendColor }]}>{changeLabel}</Text> : null}
        </>
      ) : null}
    </View>
  );
  if (onPress) return <Pressable onPress={onPress}>{inner}</Pressable>;
  return inner;
}

export function FinanceSummaryRow({
  items,
}: {
  items: Array<{ label: string; value: string; highlight?: boolean }>;
}) {
  return (
    <View style={styles.financeRow}>
      {items.map((item) => (
        <View key={item.label} style={styles.financeCell}>
          <Text style={styles.financeLabel}>{item.label}</Text>
          <Text style={[styles.financeValue, item.highlight && styles.financeHighlight]}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function TaskCard({ label, dueLabel, onPress }: { label: string; dueLabel?: string; onPress?: () => void }) {
  const inner = (
    <View style={styles.taskCard}>
      <Text style={styles.taskLabel}>{label}</Text>
      {dueLabel ? <Text style={styles.taskDue}>{dueLabel}</Text> : null}
    </View>
  );
  if (onPress) return <Pressable onPress={onPress}>{inner}</Pressable>;
  return inner;
}

export function PromoBanner({ title, subtitle, onPress }: { title: string; subtitle?: string; onPress?: () => void }) {
  const inner = (
    <View style={styles.promoBanner}>
      <Text style={styles.promoTitle}>{title}</Text>
      {subtitle ? <Text style={styles.promoSub}>{subtitle}</Text> : null}
    </View>
  );
  if (onPress) return <Pressable onPress={onPress}>{inner}</Pressable>;
  return inner;
}

export function OrderStatusChip({ label, tone = 'neutral' }: { label: string; tone?: string }) {
  const bg = tone === 'success' ? tokens.green100 : tone === 'warning' ? tokens.warningBg : tokens.card;
  return (
    <View style={[styles.orderChip, { backgroundColor: bg }]}>
      <Text style={styles.orderChipText}>{label}</Text>
    </View>
  );
}

export function DonutChart({
  segments,
  size = 140,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <View style={styles.donutWrap}>
      <View style={[styles.donutRing, { width: size, height: size, borderRadius: size / 2 }]}>
        {segments.map((seg, i) => {
          const pct = Math.round((seg.value / total) * 100);
          if (pct <= 0) return null;
          return (
            <View key={seg.label} style={styles.donutLegendRow}>
              <View style={[styles.donutDot, { backgroundColor: seg.color }]} />
              <Text style={styles.donutLegendText}>{seg.label} · {pct}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function StageProgressBar({
  dap,
  stage,
  dapMax,
}: {
  dap: number | null;
  stage?: string | null;
  dapMax?: number | null;
}) {
  const max = dapMax && dapMax > 0 ? dapMax : 120;
  const pct = dap != null ? Math.min(100, Math.round((dap / max) * 100)) : 0;
  return (
    <View style={styles.stageBarWrap}>
      <View style={styles.stageBarTrack}>
        <View style={[styles.stageBarFill, { width: `${pct}%` }]} />
      </View>
      {stage ? (
        <Text style={styles.stageBarLabel}>
          {stage}
          {dap != null ? ` · DAP ${dap}${dapMax ? ` / ${dapMax}` : ''}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

export function RoiFilterPickers({
  showCrop,
  showBlock,
  crops,
  blocks,
  selectedCrop,
  selectedBlockId,
  onCropChange,
  onBlockChange,
  allCropsLabel,
  allBlocksLabel,
}: {
  showCrop: boolean;
  showBlock: boolean;
  crops: string[];
  blocks: Array<{ id: string; name: string }>;
  selectedCrop: string | null;
  selectedBlockId: string | null;
  onCropChange: (crop: string | null) => void;
  onBlockChange: (blockId: string | null) => void;
  allCropsLabel: string;
  allBlocksLabel: string;
}) {
  const cropLabel = selectedCrop
    ? selectedCrop.charAt(0).toUpperCase() + selectedCrop.slice(1)
    : allCropsLabel;
  const blockLabel = blocks.find((b) => b.id === selectedBlockId)?.name ?? allBlocksLabel;

  return (
    <View style={styles.roiFilterRow}>
      {showCrop ? (
        <View style={styles.roiFilterCol}>
          <Text style={styles.roiFilterLabel}>{allCropsLabel}</Text>
          <View style={styles.roiPickerWrap}>
            {[null, ...crops].map((c) => {
              const id = c ?? 'all';
              const active = (c ?? null) === selectedCrop;
              return (
                <Pressable
                  key={id}
                  style={[styles.roiPickerChip, active && styles.roiPickerChipActive]}
                  onPress={() => onCropChange(c)}
                >
                  <Text style={[styles.roiPickerText, active && styles.roiPickerTextActive]}>
                    {c ? c.charAt(0).toUpperCase() + c.slice(1) : allCropsLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.roiPickerCurrent}>{cropLabel} ▼</Text>
        </View>
      ) : null}
      {showBlock ? (
        <View style={styles.roiFilterCol}>
          <Text style={styles.roiFilterLabel}>{allBlocksLabel}</Text>
          <View style={styles.roiPickerWrap}>
            {[null, ...blocks].map((b) => {
              const id = b?.id ?? 'all';
              const active = (b?.id ?? null) === selectedBlockId;
              return (
                <Pressable
                  key={id}
                  style={[styles.roiPickerChip, active && styles.roiPickerChipActive]}
                  onPress={() => onBlockChange(b?.id ?? null)}
                >
                  <Text style={[styles.roiPickerText, active && styles.roiPickerTextActive]}>
                    {b?.name ?? allBlocksLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.roiPickerCurrent}>{blockLabel} ▼</Text>
        </View>
      ) : null}
    </View>
  );
}

export function RoiStatCards({
  expenseLabel,
  incomeLabel,
  profitLabel,
  roiLabel,
  expense,
  income,
  profit,
  roiPercent,
  hasIncome,
  profitMessage,
  formatValue,
}: {
  expenseLabel: string;
  incomeLabel: string;
  profitLabel: string;
  roiLabel: string;
  expense: number;
  income: number;
  profit: number | null;
  roiPercent: number | null;
  hasIncome: boolean;
  profitMessage?: string | null;
  formatValue: (n: number) => string;
}) {
  return (
    <View style={styles.roiStatWrap}>
      <View style={styles.roiStatGrid}>
        <View style={styles.roiStatCard}>
          <Text style={styles.roiStatLabel}>{expenseLabel}</Text>
          <Text style={[styles.roiStatValue, styles.roiStatExpense]}>{formatValue(expense)}</Text>
        </View>
        <View style={styles.roiStatCard}>
          <Text style={styles.roiStatLabel}>{incomeLabel}</Text>
          <Text style={[styles.roiStatValue, styles.roiStatIncome]}>{formatValue(income)}</Text>
        </View>
        <View style={styles.roiStatCard}>
          <Text style={styles.roiStatLabel}>{profitLabel}</Text>
          <Text style={[styles.roiStatValue, hasIncome && profit != null ? styles.roiStatIncome : styles.roiStatMuted]}>
            {hasIncome && profit != null ? formatValue(profit) : '—'}
          </Text>
        </View>
        <View style={styles.roiStatCard}>
          <Text style={styles.roiStatLabel}>{roiLabel}</Text>
          <Text style={[styles.roiStatValue, hasIncome && roiPercent != null ? styles.roiStatIncome : styles.roiStatMuted]}>
            {hasIncome && roiPercent != null ? `${roiPercent}%` : '—'}
          </Text>
        </View>
      </View>
      {!hasIncome && profitMessage ? <Text style={styles.roiStatHint}>{profitMessage}</Text> : null}
    </View>
  );
}

export function RoiCropStatusCard({
  crop,
  blockName,
  acreage,
  plantingDate,
  dap,
  stageLabel,
  dapMax,
}: {
  crop: string;
  blockName: string;
  acreage: number | null;
  plantingDate: string | null;
  dap: number;
  stageLabel: string;
  dapMax?: number | null;
}) {
  return (
    <View style={styles.roiStatusCard}>
      <View style={styles.roiStatusHeader}>
        <View style={styles.roiStatusIcon}>
          <Text style={styles.roiStatusEmoji}>🌿</Text>
        </View>
        <View style={styles.roiStatusInfo}>
          <Text style={styles.roiStatusCrop}>{crop}</Text>
          <Text style={styles.roiStatusBlock}>{blockName}</Text>
          {acreage != null ? <Text style={styles.roiStatusMeta}>{acreage} acre</Text> : null}
        </View>
      </View>
      <View style={styles.roiStatusGrid}>
        {plantingDate ? (
          <View style={styles.roiStatusCell}>
            <Text style={styles.roiStatusCellLabel}>Planting</Text>
            <Text style={styles.roiStatusCellValue}>{plantingDate}</Text>
          </View>
        ) : null}
        <View style={styles.roiStatusCell}>
          <Text style={styles.roiStatusCellLabel}>DAP</Text>
          <Text style={styles.roiStatusCellValue}>{dap}</Text>
        </View>
        <View style={styles.roiStatusCell}>
          <Text style={styles.roiStatusCellLabel}>Stage</Text>
          <Text style={styles.roiStatusCellValue}>{stageLabel}</Text>
        </View>
      </View>
      <StageProgressBar dap={dap} stage={stageLabel} dapMax={dapMax} />
    </View>
  );
}

export function RoiHarvestGrid({
  title,
  harvestCount,
  totalQtyKg,
  totalIncomeInr,
  averageRate,
  bestRate,
  lowestRate,
  formatValue,
  labels,
}: {
  title: string;
  harvestCount: number;
  totalQtyKg: number;
  totalIncomeInr: number;
  averageRate: number | null;
  bestRate?: number | null;
  lowestRate?: number | null;
  formatValue: (n: number) => string;
  labels: {
    entries: string;
    totalQty: string;
    totalIncome: string;
    avgRate: string;
    bestRate: string;
    lowestRate: string;
  };
}) {
  return (
    <View style={styles.roiHarvestCard}>
      <Text style={styles.roiHarvestTitle}>{title}</Text>
      <View style={styles.roiHarvestGrid}>
        <View style={styles.roiHarvestCell}>
          <Text style={styles.roiHarvestLabel}>{labels.entries}</Text>
          <Text style={styles.roiHarvestValue}>{harvestCount}</Text>
        </View>
        <View style={styles.roiHarvestCell}>
          <Text style={styles.roiHarvestLabel}>{labels.totalQty}</Text>
          <Text style={styles.roiHarvestValue}>{totalQtyKg} kg</Text>
        </View>
        <View style={styles.roiHarvestCell}>
          <Text style={styles.roiHarvestLabel}>{labels.totalIncome}</Text>
          <Text style={styles.roiHarvestValue}>{formatValue(totalIncomeInr)}</Text>
        </View>
        <View style={styles.roiHarvestCell}>
          <Text style={styles.roiHarvestLabel}>{labels.avgRate}</Text>
          <Text style={styles.roiHarvestValue}>
            {averageRate != null ? `${formatValue(averageRate)}/kg` : '—'}
          </Text>
        </View>
        {bestRate != null ? (
          <View style={styles.roiHarvestCell}>
            <Text style={styles.roiHarvestLabel}>{labels.bestRate}</Text>
            <Text style={styles.roiHarvestValue}>{formatValue(bestRate)}/kg</Text>
          </View>
        ) : null}
        {lowestRate != null ? (
          <View style={styles.roiHarvestCell}>
            <Text style={styles.roiHarvestLabel}>{labels.lowestRate}</Text>
            <Text style={styles.roiHarvestValue}>{formatValue(lowestRate)}/kg</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function RoiQuickActionsRow({
  title,
  actions,
}: {
  title: string;
  actions: Array<{ id: string; label: string; subtitle: string; onPress: () => void }>;
}) {
  return (
    <View style={styles.roiQuickWrap}>
      <Text style={styles.roiQuickTitle}>{title}</Text>
      <View style={styles.roiQuickRow}>
        {actions.map((a) => (
          <Pressable key={a.id} style={styles.roiQuickCard} onPress={a.onPress}>
            <Text style={styles.roiQuickLabel}>{a.label}</Text>
            <Text style={styles.roiQuickSub}>{a.subtitle}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  healthBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  healthBadgeText: { fontSize: 11, fontWeight: '700' },
  fieldCard: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    marginBottom: 10,
  },
  blockPressable: { marginBottom: 10 },
  blockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    gap: 12,
  },
  blockCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: tokens.green100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockCardEmoji: { fontSize: 28 },
  blockCardBody: { flex: 1 },
  blockDetailRow: { fontSize: 12, color: tokens.textMuted, marginTop: 3 },
  blockDetailLabel: { color: tokens.textMuted },
  blockDetailValue: { color: tokens.text, fontWeight: '600' },
  blockChevron: { fontSize: 24, color: tokens.textMuted, paddingHorizontal: 4 },
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  fieldName: { fontSize: 16, fontWeight: '700', color: tokens.text, flex: 1 },
  fieldMeta: { fontSize: 13, color: tokens.textMuted, marginTop: 6 },
  fieldSub: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
  fieldAlert: { fontSize: 12, color: tokens.danger, marginTop: 6, fontWeight: '600' },
  alertCard: {
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    marginBottom: 10,
  },
  alertMessage: { fontSize: 14, color: tokens.text, lineHeight: 20 },
  alertMeta: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: tokens.text },
  sectionAction: { fontSize: 13, color: tokens.green700, fontWeight: '600' },
  productWrap: { flex: 1, maxWidth: '50%' },
  productCard: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 10,
    marginBottom: 10,
  },
  productImage: { width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 8 },
  productImagePh: { backgroundColor: tokens.border },
  recTag: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: tokens.green700,
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  productTitle: { fontSize: 13, fontWeight: '600', color: tokens.text, minHeight: 34 },
  productPrice: { fontSize: 14, fontWeight: '700', color: tokens.green800, marginTop: 4 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: {
    backgroundColor: tokens.green700,
    borderRadius: tokens.radiusSm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: tokens.green500,
  },
  quickBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  pressed: { opacity: 0.9 },
  marketCard: {
    backgroundColor: tokens.green800,
    borderRadius: tokens.radiusSm,
    padding: 16,
    marginBottom: 12,
  },
  marketCrop: { fontSize: 12, color: '#c8e6c9', fontWeight: '600', textTransform: 'uppercase' },
  marketName: { fontSize: 13, color: '#e8f5e9', marginTop: 4 },
  marketRateLabel: { fontSize: 11, color: '#c8e6c9', marginTop: 8 },
  marketPending: { fontSize: 14, fontWeight: '600', color: '#fef3c7', marginTop: 10 },
  marketUpdatedOn: { fontSize: 11, color: '#c8e6c9', marginTop: 4 },
  marketPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  marketPrice: { fontSize: 28, fontWeight: '800', color: '#fff' },
  marketTrend: { fontSize: 22, fontWeight: '700' },
  marketChange: { fontSize: 14, fontWeight: '600', marginTop: 6, color: '#e8f5e9' },
  financeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  financeCell: {
    flex: 1,
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
  },
  financeLabel: { fontSize: 11, color: tokens.textMuted, marginBottom: 4 },
  financeValue: { fontSize: 15, fontWeight: '700', color: tokens.text },
  financeHighlight: { color: tokens.green700 },
  taskCard: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    marginBottom: 8,
  },
  taskLabel: { fontSize: 14, fontWeight: '600', color: tokens.text },
  taskDue: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
  promoBanner: {
    backgroundColor: tokens.green700,
    borderRadius: tokens.radiusSm,
    padding: 16,
    marginBottom: 12,
  },
  promoTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  promoSub: { fontSize: 13, color: '#e8f5e9', marginTop: 4 },
  orderChip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 4 },
  orderChipText: { fontSize: 11, fontWeight: '700', color: tokens.text },
  donutWrap: { alignItems: 'center', marginVertical: 8 },
  donutRing: {
    borderWidth: 12,
    borderColor: tokens.green500,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  donutLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  donutDot: { width: 10, height: 10, borderRadius: 5 },
  donutLegendText: { fontSize: 13, color: tokens.text },
  stageBarWrap: { marginVertical: 8 },
  stageBarTrack: { height: 8, backgroundColor: tokens.border, borderRadius: 4, overflow: 'hidden' },
  stageBarFill: { height: 8, backgroundColor: tokens.green700, borderRadius: 4 },
  stageBarLabel: { fontSize: 12, color: tokens.textMuted, marginTop: 6 },
  selectorWrap: { marginBottom: 12, gap: 10 },
  selectorRow: { gap: 6 },
  selectorLabel: { fontSize: 11, fontWeight: '700', color: tokens.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  selectorChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectorChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  selectorChipActive: { backgroundColor: tokens.green100, borderColor: tokens.green700 },
  selectorChipPending: { opacity: 0.65 },
  selectorChipText: { fontSize: 14, fontWeight: '600', color: tokens.text },
  selectorChipTextActive: { color: tokens.green800 },
  heroCard: {
    backgroundColor: tokens.green800,
    borderRadius: tokens.radius,
    padding: 16,
    marginBottom: 12,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  heroCropCol: { flexDirection: 'row', gap: 12, flex: 1 },
  heroCropIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCropEmoji: { fontSize: 28 },
  heroCropInfo: { flex: 1 },
  heroCropName: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  heroDapBadge: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.green500,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 6,
  },
  heroDapText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  heroStage: { fontSize: 13, color: '#e8f5e9', marginTop: 6 },
  heroPriceCol: { alignItems: 'flex-end' },
  heroRateLabel: { fontSize: 11, color: '#c8e6c9' },
  heroPrice: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 4 },
  heroPendingRate: { fontSize: 13, fontWeight: '600', color: '#fef3c7', marginTop: 6, textAlign: 'right', maxWidth: 150 },
  heroUpdatedOn: { fontSize: 10, color: '#c8e6c9', marginTop: 4, textAlign: 'right' },
  heroDailyTrend: { fontSize: 12, fontWeight: '600', color: tokens.green500, marginTop: 4 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 12 },
  heroYoYRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroYoYItem: { fontSize: 11, color: '#e8f5e9' },
  heroYoYPos: { color: tokens.green500, fontWeight: '600' },
  heroMarketMeta: { fontSize: 11, color: '#c8e6c9', marginTop: 8 },
  analyticsPanel: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radius,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    marginBottom: 12,
  },
  analyticsHeader: { gap: 10, marginBottom: 10 },
  analyticsTitle: { fontSize: 15, fontWeight: '700', color: tokens.text },
  rangePills: { flexDirection: 'row', gap: 6 },
  rangePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: tokens.bg,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  rangePillActive: { backgroundColor: tokens.green100, borderColor: tokens.green700 },
  rangePillText: { fontSize: 12, fontWeight: '600', color: tokens.textMuted },
  rangePillTextActive: { color: tokens.green800 },
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  toggleChip: { paddingVertical: 4 },
  toggleText: { fontSize: 12, color: tokens.textMuted },
  toggleTextActive: { color: tokens.green700, fontWeight: '700' },
  toggleTextMutedActive: { color: tokens.textMuted, fontWeight: '700' },
  weatherBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tokens.warningBg,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.warning,
    padding: 12,
    marginBottom: 12,
  },
  weatherIcon: { fontSize: 18, color: tokens.warning },
  weatherMessage: { flex: 1, fontSize: 13, fontWeight: '600', color: tokens.warning },
  weatherAction: { fontSize: 12, fontWeight: '700', color: tokens.green700 },
  homeQuickWrap: { marginBottom: 12 },
  homeQuickTitle: { fontSize: 16, fontWeight: '700', color: tokens.text, marginBottom: 10 },
  homeQuickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  homeQuickCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    minHeight: 110,
  },
  homeQuickIcon: { fontSize: 22, marginBottom: 8 },
  homeQuickLabel: { fontSize: 14, fontWeight: '700', color: tokens.text },
  homeQuickSub: { fontSize: 11, color: tokens.textMuted, marginTop: 4, paddingRight: 12 },
  homeQuickChevron: { position: 'absolute', right: 12, top: 14, fontSize: 18, color: tokens.textMuted },
  roiFilterRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  roiFilterCol: { flex: 1 },
  roiFilterLabel: { fontSize: 11, fontWeight: '700', color: tokens.textMuted, marginBottom: 6, textTransform: 'uppercase' },
  roiPickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  roiPickerChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  roiPickerChipActive: { backgroundColor: tokens.green100, borderColor: tokens.green700 },
  roiPickerText: { fontSize: 12, fontWeight: '600', color: tokens.text },
  roiPickerTextActive: { color: tokens.green800 },
  roiPickerCurrent: { fontSize: 13, fontWeight: '700', color: tokens.green800 },
  roiStatWrap: { marginBottom: 12 },
  roiStatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roiStatCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
  },
  roiStatLabel: { fontSize: 11, color: tokens.textMuted, marginBottom: 4 },
  roiStatValue: { fontSize: 18, fontWeight: '800', color: tokens.text },
  roiStatExpense: { color: tokens.danger },
  roiStatIncome: { color: tokens.green800 },
  roiStatMuted: { color: tokens.textMuted, fontSize: 16 },
  roiStatHint: { fontSize: 12, color: tokens.textMuted, fontStyle: 'italic', marginTop: 8 },
  roiStatusCard: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radius,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    marginBottom: 12,
  },
  roiStatusHeader: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  roiStatusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.green100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roiStatusEmoji: { fontSize: 24 },
  roiStatusInfo: { flex: 1 },
  roiStatusCrop: { fontSize: 18, fontWeight: '800', color: tokens.text },
  roiStatusBlock: { fontSize: 14, color: tokens.textMuted, marginTop: 2 },
  roiStatusMeta: { fontSize: 12, color: tokens.textMuted, marginTop: 2 },
  roiStatusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  roiStatusCell: { minWidth: '30%' },
  roiStatusCellLabel: { fontSize: 11, color: tokens.textMuted },
  roiStatusCellValue: { fontSize: 14, fontWeight: '700', color: tokens.text },
  roiHarvestCard: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    marginBottom: 12,
  },
  roiHarvestTitle: { fontSize: 15, fontWeight: '700', color: tokens.text, marginBottom: 10 },
  roiHarvestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  roiHarvestCell: { width: '47%' },
  roiHarvestLabel: { fontSize: 11, color: tokens.textMuted },
  roiHarvestValue: { fontSize: 15, fontWeight: '700', color: tokens.text, marginTop: 2 },
  roiQuickWrap: { marginBottom: 12 },
  roiQuickTitle: { fontSize: 15, fontWeight: '700', color: tokens.text, marginBottom: 8 },
  roiQuickRow: { flexDirection: 'row', gap: 8 },
  roiQuickCard: {
    flex: 1,
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    minHeight: 72,
  },
  roiQuickLabel: { fontSize: 13, fontWeight: '700', color: tokens.text },
  roiQuickSub: { fontSize: 11, color: tokens.textMuted, marginTop: 4 },
});
