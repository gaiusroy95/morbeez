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

import { ActiveCyclesScroller, RoiExpenseBookPreview } from '@/components/roi/RoiInlinePanels';
import { RoiTransactionsPreview } from '@/components/roi/RoiTransactionsPreview';

import { FinishCycleFlow } from '@/components/roi/FinishCycleFlow';

import { useFarmerAuth } from '@/context/FarmerAuthContext';

import { useRoiFilter } from '@/context/RoiFilterContext';

import { useLocale } from '@/context/LocaleContext';



type RoiSubTab = 'transactions' | 'expenseBook';



export default function RoiTabScreen() {

  const router = useRouter();

  const { locale } = useLocale();

  const { farmer } = useFarmerAuth();

  const { filter, setCrop, setBlockId } = useRoiFilter();

  const [data, setData] = useState<RoiDashboardV2 | null>(null);

  const [activeCycles, setActiveCycles] = useState<Awaited<ReturnType<typeof fetchRoiHistoryV2>>['active']>([]);

  const [subTab, setSubTab] = useState<RoiSubTab>('transactions');

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

      router.push('/roi/history');

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

  const farmScope = !filter.crop && !filter.blockId;



  const subTabs: Array<{ id: RoiSubTab; label: string }> = [

    { id: 'transactions', label: t('transactions', locale) },

    ...(vis?.showExpenseBook ? [{ id: 'expenseBook' as const, label: t('expenseBook', locale) }] : []),

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

              id: 'finish',

              label: t('finishCropCycle', locale),

              subtitle: t('finishCropCycleSub', locale),

              onPress: () => {

                if (status?.seasonId) setFinishOpen(true);

                else router.push('/roi/start-cycle');

              },

            },

            {

              id: 'history',

              label: t('history', locale),

              subtitle: t('viewPastCycles', locale),

              onPress: () => router.push('/roi/history'),

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



        {subTab === 'transactions' ? <RoiTransactionsPreview filter={filter} locale={locale} limit={10} /> : null}

        {subTab === 'expenseBook' && vis?.showExpenseBook ? (

          <RoiExpenseBookPreview filter={filter} locale={locale} />

        ) : null}

      </ScrollView>



      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <View style={styles.footerBtn}>
            <Btn label={t('income', locale)} onPress={() => router.push('/roi/transactions/add-income')} />
          </View>
          <View style={styles.footerBtn}>
            <Btn
              label={t('expense', locale)}
              variant="secondary"
              onPress={() => router.push('/roi/transactions/add-expense')}
            />
          </View>
        </View>
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

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: tokens.border, backgroundColor: tokens.bg },
  footerRow: { flexDirection: 'row', gap: 8 },
  footerBtn: { flex: 1 },
});


