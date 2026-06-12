import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSyncConsoleSearchMode } from '../hooks/useSyncConsoleSearch';
import { defaultsForPage } from '../lib/console-page-search';
import { matchesSearch } from '../lib/search-filter';
import {
  DEFAULT_TAB,
  defaultSectionForRole,
  defaultTabForRole,
  isSubTabForSection,
  opsSearchMode,
  parseOpsHubParams,
  type OpsSection,
  type OpsSubTab,
  visibleSubTabs,
} from '../lib/operations-hub-nav';
import { OperationsHubShell } from '../components/operations/OperationsHubShell';
import { OperationsCommunicationsSection } from '../components/operations/OperationsCommunicationsSection';
import { OperationsKnowledgeSection } from '../components/operations/OperationsKnowledgeSection';
import { OperationsAutomationSection } from '../components/operations/OperationsAutomationSection';
import { OperationsMarketSection } from '../components/operations/OperationsMarketSection';
import { Alert, Loading } from '../components/ui';

const base = '/morbeez-staff/api/v1/os/operations';

export function OperationsCenterPage({ canWrite }: { canWrite: boolean }) {
  const { admin, can } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const parsed = parseOpsHubParams(searchParams);
  const [section, setSection] = useState<OpsSection>(parsed.section);
  const [subTab, setSubTab] = useState<OpsSubTab>(parsed.tab);

  const visibility = useMemo(
    () => ({
      canIntelligence: can('intelligence', 'read'),
      canSettings: can('settings', 'write'),
      isAdminRole: admin?.role === 'admin' || admin?.role === 'super_admin',
    }),
    [can, admin?.role]
  );

  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [terminologyRefreshKey, setTerminologyRefreshKey] = useState(0);
  const searchDefaults = defaultsForPage('operations');
  useSyncConsoleSearchMode(
    opsSearchMode(section, subTab),
    search,
    setSearch,
    searchDefaults.placeholder ?? 'Search prices, terms, quick replies, templates…'
  );

  const [termStatus, setTermStatus] = useState('open');
  const [quickReplies, setQuickReplies] = useState<
    Array<{
      id: string;
      shortcut_key: string;
      category: string;
      label_en: string;
      body_en: string;
      body_ml: string | null;
      active: boolean;
      sort_order: number;
    }>
  >([]);
  const [qrCategory, setQrCategory] = useState('all');
  const [tplStatus, setTplStatus] = useState('all');
  const [tplCategory, setTplCategory] = useState('all');
  const [autoJobs, setAutoJobs] = useState<
    Array<{
      id: string;
      job_type: string;
      status: string;
      scheduled_at: string;
      attempts: number;
      last_error: string | null;
      farmerName: string;
      farmerPhone: string | null;
      payload: Record<string, unknown>;
    }>
  >([]);
  const [autoStats, setAutoStats] = useState<Record<string, number> | null>(null);
  const [jobStatus, setJobStatus] = useState('active');
  const [jobType, setJobType] = useState('all');

  const [termForm, setTermForm] = useState({
    term: '',
    rawMessage: '',
    farmerPhone: '',
    language: 'ml',
    cropType: 'cardamom',
    district: '',
  });

  useEffect(() => {
    if (!searchParams.get('section') && !searchParams.get('tab')) {
      const section = defaultSectionForRole(admin?.role);
      const tab = defaultTabForRole(admin?.role, section);
      if (section !== 'communications' || tab !== 'broadcasts') {
        const params = new URLSearchParams();
        params.set('section', section);
        params.set('tab', tab);
        navigate(`/operations?${params.toString()}`, { replace: true });
      }
    }
  }, [admin?.role, navigate, searchParams]);

  useEffect(() => {
    const p = parseOpsHubParams(searchParams);
    setSection(p.section);
    setSubTab(p.tab);
  }, [searchParams]);

  const syncUrl = useCallback(
    (nextSection: OpsSection, nextTab: OpsSubTab) => {
      const params = new URLSearchParams();
      if (nextSection === 'communications' && nextTab === 'broadcasts') {
        setSearchParams(params, { replace: true });
        return;
      }
      params.set('section', nextSection);
      params.set('tab', nextTab);
      setSearchParams(params, { replace: true });
    },
    [setSearchParams]
  );

  const onSectionChange = useCallback(
    (nextSection: OpsSection) => {
      const allowed = visibleSubTabs(nextSection, visibility);
      let nextTab = isSubTabForSection(nextSection, subTab) && allowed.some((t) => t.id === subTab)
        ? subTab
        : allowed[0]?.id ?? DEFAULT_TAB[nextSection];
      setSection(nextSection);
      setSubTab(nextTab);
      syncUrl(nextSection, nextTab);
    },
    [subTab, syncUrl, visibility]
  );

  const onSubTabChange = useCallback(
    (nextTab: OpsSubTab) => {
      setSubTab(nextTab);
      syncUrl(section, nextTab);
    },
    [section, syncUrl]
  );

  const visibleQuickReplies = useMemo(
    () =>
      quickReplies.filter((r) =>
        matchesSearch(search, r.shortcut_key, r.category, r.label_en, r.body_en, r.body_ml)
      ),
    [quickReplies, search]
  );
  const visibleAutoJobs = useMemo(
    () =>
      autoJobs.filter((j) =>
        matchesSearch(
          search,
          j.job_type,
          j.status,
          j.farmerName,
          j.farmerPhone,
          j.last_error,
          JSON.stringify(j.payload)
        )
      ),
    [autoJobs, search]
  );

  const loadSectionData = useCallback(async () => {
    if (section === 'communications' && subTab === 'quickReplies') {
      setLoading(true);
      setError('');
      try {
        const q = qrCategory !== 'all' ? `?category=${encodeURIComponent(qrCategory)}` : '';
        const d = await api<{ ok: boolean; replies: typeof quickReplies }>(`${base}/quick-replies${q}`);
        setQuickReplies(d.replies ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    } else if (section === 'automation' && subTab === 'jobMonitor') {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        params.set('status', jobStatus);
        if (jobType !== 'all') params.set('jobType', jobType);
        const [jobsRes, statsRes] = await Promise.all([
          api<{ ok: boolean; jobs: typeof autoJobs }>(`${base}/automation-jobs?${params}`),
          api<{ ok: boolean; stats: Record<string, number> }>(`${base}/automation-jobs/stats`),
        ]);
        setAutoJobs(jobsRes.jobs ?? []);
        setAutoStats(statsRes.stats ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [section, subTab, qrCategory, jobStatus, jobType]);

  useEffect(() => {
    void loadSectionData();
  }, [loadSectionData]);

  async function createTermTask(e: FormEvent) {
    e.preventDefault();
    if (!canWrite || !termForm.term.trim()) return;
    setError('');
    try {
      await api(`${base}/terminology/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          term: termForm.term.trim(),
          rawMessage: termForm.rawMessage.trim() || termForm.term.trim(),
          language: termForm.language,
          cropType: termForm.cropType || undefined,
          district: termForm.district || undefined,
          farmerPhone: termForm.farmerPhone.trim() || undefined,
        }),
      });
      setTermForm((f) => ({ ...f, term: '', rawMessage: '' }));
      setTermStatus('open');
      setTerminologyRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add terminology task');
    }
  }

  const communicationsSubTab =
    subTab === 'broadcasts' || subTab === 'whatsappTemplates' || subTab === 'quickReplies'
      ? subTab
      : 'broadcasts';
  const knowledgeSubTab = subTab === 'terminology' || subTab === 'concepts' ? subTab : 'terminology';
  const automationSubTab =
    subTab === 'campaignRules' || subTab === 'weatherAdvisory' || subTab === 'jobMonitor'
      ? subTab
      : 'campaignRules';

  return (
    <OperationsHubShell
      section={section}
      subTab={subTab}
      onSectionChange={onSectionChange}
      onSubTabChange={onSubTabChange}
      canWrite={canWrite}
      visibility={visibility}
    >
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <Loading /> : null}
      {!loading && section === 'communications' ? (
        <OperationsCommunicationsSection
          subTab={communicationsSubTab}
          canWrite={canWrite}
          search={search}
          quickReplies={visibleQuickReplies}
          qrCategory={qrCategory}
          onQrCategoryChange={setQrCategory}
          onRefresh={() => void loadSectionData()}
          tplStatus={tplStatus}
          tplCategory={tplCategory}
          onTplStatusChange={setTplStatus}
          onTplCategoryChange={setTplCategory}
        />
      ) : null}
      {!loading && section === 'knowledge' ? (
        <OperationsKnowledgeSection
          subTab={knowledgeSubTab}
          canWrite={canWrite}
          search={search}
          termStatus={termStatus}
          onTermStatusChange={setTermStatus}
          terminologyRefreshKey={terminologyRefreshKey}
          termForm={termForm}
          setTermForm={setTermForm}
          onCreateTermTask={createTermTask}
        />
      ) : null}
      {!loading && section === 'automation' ? (
        <OperationsAutomationSection
          subTab={automationSubTab}
          canWrite={canWrite}
          canIntelligence={visibility.canIntelligence}
          jobs={visibleAutoJobs}
          stats={autoStats}
          jobStatus={jobStatus}
          jobType={jobType}
          onJobStatusChange={setJobStatus}
          onJobTypeChange={setJobType}
          onRefresh={() => void loadSectionData()}
        />
      ) : null}
      {section === 'market' ? (
        <OperationsMarketSection canWrite={canWrite} search={search} onError={setError} />
      ) : null}
    </OperationsHubShell>
  );
}
