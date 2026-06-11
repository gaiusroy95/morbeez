import { useCallback, useEffect, useState } from 'react';

import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useRouter } from 'expo-router';

import {

  fetchRoiHistoryV2,

  fetchRoiSummary,

  finishCropCycle,

  formatDateInLocale,

  formatInr,

  t,

  tokens,

  type RoiDashboardV2,

} from '@morbeez/shared';

import {

  AlertBox,

  Btn,

  HubTabs,

  Loading,

  Panel,

  RoiCropStatusCard,

  RoiFilterPickers,

  RoiHarvestGrid,

  RoiQuickActionsRow,

  RoiStatCards,

} from '@morbeez/ui-native';

import { ActiveCyclesScroller, RoiAnalyticsPreview, RoiExpenseBookPreview, RoiHistoryPreview, RoiTransactionsPreview } from '@/components/roi/RoiInlinePanels';

import { FinishCycleFlow } from '@/components/roi/FinishCycleFlow';

import { PieDonutChart } from '@/components/roi/PieDonutChart';

import { useFarmerAuth } from '@/context/FarmerAuthContext';

import { useRoiFilter } from '@/context/RoiFilterContext';

import { useLocale } from '@/context/LocaleContext';



type RoiSubTab = 'overview' | 'transactions' | 'analytics' | 'history' | 'expenseBook';



export default function RoiTabScreen() {

  const router = useRouter();

  const { locale } = useLocale();

  const { farmer } = useFarmerAuth();

  const { filter, setCrop, setBlockId } = useRoiFilter();

  const [data, setData] = useState<RoiDashboardV2 | null>(null);

  const [activeCycles, setActiveCycles] = useState<Awaited<ReturnType<typeof fetchRoiHistoryV2>>['active']>([]);

  const [subTab, setSubTab] = useState<RoiSubTab>('overview');

  const [error, setError] = useState('');

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [finishing, setFinishing] = useState(false);

  const [finishOpen, setFinishOpen] = useState(false);



  const load = useCallback(async () => {

    setError('');

    try {

      const [summary, history] = await Promise.all([fetchRoiSummary(filter), fetchRoiHistoryV2()]);

      setData(summary);

      setActiveCycles(history.active);

    } catch (e) {

      setError(e instanceof Error ? e.message : 'Could not load ROI');

    } finally {

      setLoading(false);

      setRefreshing(false);

    }

  }, [filter]);



  useEffect(() => {

    void load();

  }, [load]);



  async function onFinishCycle(opts: { password?: string; confirmText: string }) {

    const seasonId = data?.cropStatus?.seasonId;

    if (!seasonId) return;

    setFinishing(true);

    try {

      await finishCropCycle(seasonId, opts);

      setFinishOpen(false);

      setSubTab('history');

      await load();

    } catch (e) {

      throw e;

    } finally {

      setFinishing(false);

    }

  }



  if (loading) return <Loading label={t('loading', locale)} />;



  const vis = data?.visibility;

  const fin = data?.financial;

  const harvest = data?.harvestSummary;

  const status = data?.cropStatus;

  const segments =

    data?.breakdown

      .filter((s) => s.value > 0)

      .map((s) => ({ label: s.label, value: s.value, color: s.color })) ?? [];

  const totalExpense = segments.reduce((s, x) => s + x.value, 0);

  const farmScope = !filter.crop && !filter.blockId;



  const subTabs: Array<{ id: RoiSubTab; label: string }> = [

    { id: 'overview', label: t('overview', locale) },

    { id: 'transactions', label: t('transactions', locale) },

    ...(vis?.showExpenseBook ? [{ id: 'expenseBook' as const, label: t('expenseBook', locale) }] : []),

    { id: 'analytics', label: t('analytics', locale) },

    { id: 'history', label: t('history', locale) },

  ];



  const plantingLabel = status?.plantingDate

    ? formatDateInLocale(status.plantingDate, locale)

    : null;



  return (

    <View style={styles.root}>

      <ScrollView

        style={styles.scroll}

        contentContainerStyle={styles.content}

        refreshControl={

          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />

        }

      >

        {error ? <AlertBox>{error}</AlertBox> : null}



        {farmScope ? (

          <Text style={styles.farmTitle}>{t('allFarming', locale)}</Text>

        ) : null}



        <RoiFilterPickers

          showCrop={Boolean(vis?.showCropFilter)}

          showBlock={Boolean(vis?.showBlockFilter)}

          crops={data?.crops ?? []}

          blocks={(data?.blocks ?? []).map((b) => ({ id: b.id, name: b.name }))}

          selectedCrop={filter.crop ?? null}

          selectedBlockId={filter.blockId ?? null}

          onCropChange={setCrop}

          onBlockChange={setBlockId}

          allCropsLabel={t('allCrops', locale)}

          allBlocksLabel={t('allBlocks', locale)}

        />



        {farmScope && activeCycles.length > 1 ? (

          <ActiveCyclesScroller items={activeCycles} locale={locale} />

        ) : null}



        {status ? (

          <RoiCropStatusCard

            crop={status.crop}

            blockName={status.blockName}

            acreage={status.acreage}

            plantingDate={plantingLabel}

            dap={status.dap}

            stageLabel={status.stageLabel}

            dapMax={status.dapMax}

          />

        ) : null}



        {fin ? (

          <Panel title={t('financialSummary', locale)}>

            <RoiStatCards

              expenseLabel={t('spent', locale)}

              incomeLabel={t('totalIncome', locale)}

              profitLabel={t('profit', locale)}

              roiLabel={t('roi', locale)}

              expense={fin.expenseInr}

              income={fin.incomeInr}

              profit={fin.profitInr}

              roiPercent={fin.roiPercent}

              hasIncome={fin.hasIncome}

              profitMessage={fin.profitMessage}

              formatValue={formatInr}

            />

          </Panel>

        ) : null}



        {harvest ? (

          <RoiHarvestGrid

            title={t('harvestSummary', locale)}

            harvestCount={harvest.harvestCount}

            totalQtyKg={harvest.totalQtyKg}

            totalIncomeInr={harvest.totalIncomeInr}

            averageRate={harvest.averageRatePerKg}

            bestRate={harvest.bestRatePerKg}

            lowestRate={harvest.lowestRatePerKg}

            formatValue={formatInr}

            labels={{

              entries: t('harvestEntries', locale),

              totalQty: t('totalQty', locale),

              totalIncome: t('totalIncome', locale),

              avgRate: t('avgRate', locale),

              bestRate: t('bestRate', locale),

              lowestRate: t('lowestRate', locale),

            }}

          />

        ) : null}



        <RoiQuickActionsRow

          title={t('quickActions', locale)}

          actions={[

            {

              id: 'add',

              label: t('addTransaction', locale),

              subtitle: t('addTransactionSub', locale),

              onPress: () => router.push('/roi/transactions/add'),

            },

            {

              id: 'history',

              label: t('history', locale),

              subtitle: t('viewPastCycles', locale),

              onPress: () => setSubTab('history'),

            },

            {

              id: 'start',

              label: t('startNewCycle', locale),

              subtitle: t('newCropCycle', locale),

              onPress: () => router.push('/roi/start-cycle'),

            },

          ]}

        />



        <HubTabs tabs={subTabs} active={subTab} onChange={setSubTab} />



        {subTab === 'overview' && segments.length ? (

          <Panel title={t('expenseBreakdown', locale)}>

            <PieDonutChart

              segments={segments}

              centerLabel={t('spent', locale)}

              centerValue={formatInr(totalExpense)}

              formatValue={formatInr}

            />

          </Panel>

        ) : null}



        {subTab === 'overview' && data?.recentTransactions.length ? (

          <Panel title={t('recentExpenses', locale)}>

            {data.recentTransactions.slice(0, 5).map((tx) => (

              <View key={tx.id} style={styles.txRow}>

                <Text style={styles.txLabel} numberOfLines={1}>

                  {tx.dateLabel} · {tx.label}

                </Text>

                <Text style={[styles.txAmt, tx.type === 'income' ? styles.income : styles.expense]}>

                  {tx.type === 'income' ? '+' : '-'}

                  {formatInr(tx.amountInr)}

                </Text>

              </View>

            ))}

            <Btn label={t('openFullLedger', locale)} variant="secondary" onPress={() => router.push('/roi/transactions')} />

          </Panel>

        ) : null}



        {subTab === 'transactions' ? <RoiTransactionsPreview filter={filter} locale={locale} /> : null}

        {subTab === 'expenseBook' && vis?.showExpenseBook ? (

          <RoiExpenseBookPreview filter={filter} locale={locale} />

        ) : null}

        {subTab === 'analytics' ? <RoiAnalyticsPreview filter={filter} locale={locale} /> : null}

        {subTab === 'history' ? <RoiHistoryPreview locale={locale} /> : null}

      </ScrollView>



      <View style={styles.footer}>

        <Btn label={t('addTransaction', locale)} onPress={() => router.push('/roi/transactions/add')} />

        {status?.seasonId ? (

          <Btn

            label={finishing ? t('loading', locale) : t('finishCropCycle', locale)}

            variant="secondary"

            onPress={() => setFinishOpen(true)}

            disabled={finishing}

          />

        ) : (

          <Btn label={t('startNewCycle', locale)} variant="secondary" onPress={() => router.push('/roi/start-cycle')} />

        )}

      </View>



      {status?.seasonId && fin ? (

        <FinishCycleFlow

          visible={finishOpen}

          onClose={() => setFinishOpen(false)}

          onFinish={onFinishCycle}

          crop={status.crop}

          blockName={status.blockName}

          dap={status.dap}

          expenseInr={fin.expenseInr}

          incomeInr={fin.incomeInr}

          profitInr={fin.profitInr}

          requiresPassword={Boolean(farmer?.hasPassword)}

          busy={finishing}

        />

      ) : null}

    </View>

  );

}



const styles = StyleSheet.create({

  root: { flex: 1, backgroundColor: tokens.bg },

  scroll: { flex: 1 },

  content: { padding: 16, paddingBottom: 100, gap: 4 },

  farmTitle: { fontSize: 18, fontWeight: '800', color: tokens.text, marginBottom: 8 },

  txRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 8 },

  txLabel: { flex: 1, fontSize: 13, color: tokens.text },

  txAmt: { fontSize: 13, fontWeight: '700' },

  income: { color: tokens.green800 },

  expense: { color: tokens.text },

  footer: { padding: 16, gap: 8, borderTopWidth: 1, borderTopColor: tokens.border, backgroundColor: tokens.bg },

});


