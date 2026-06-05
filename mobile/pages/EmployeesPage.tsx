import { ConsoleScreenLayout } from '@/components/layout/ConsoleScreenLayout';
import { Alert, Badge, EmptyState, ListCard, Loading, Panel, StatCard } from '@/components/ui';
import { api } from '@/lib/api';
import { formatInrFull, roleLabel } from '@/lib/format';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

type Employee = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  active: boolean;
  performanceScore: number;
  performanceLabel: string;
  turnoverInr: number;
  pendingTasks: number;
};

type Workspace = {
  summary: {
    totalEmployees: number;
    activeCount: number;
    avgPerformanceScore: number;
    pendingTasks: number;
  };
  employees: Employee[];
};

export function EmployeesPage({ canWrite }: { canWrite?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ ok: boolean } & Workspace>('/morbeez-staff/api/v1/staff/workspace')
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load employees'))
      .finally(() => setLoading(false));
  }, []);

  const compare = 'team avg';

  return (
    <ConsoleScreenLayout scroll={false}>
      {error ? <Alert>{error}</Alert> : null}
      {loading || !data ? (
        <Loading label="Loading employees…" />
      ) : (
        <FlatList
          data={data.employees}
          keyExtractor={(e) => e.id}
          ListHeaderComponent={
            <>
              <View style={styles.stats}>
                <StatCard label="Employees" value={String(data.summary.totalEmployees)} trendPct={0} compare={compare} />
                <StatCard label="Active" value={String(data.summary.activeCount)} trendPct={0} compare={compare} />
                <StatCard
                  label="Avg performance"
                  value={String(data.summary.avgPerformanceScore)}
                  trendPct={0}
                  compare={compare}
                />
                <StatCard label="Pending tasks" value={String(data.summary.pendingTasks)} trendPct={0} compare={compare} />
              </View>
              <Panel title="Team">{null}</Panel>
            </>
          }
          renderItem={({ item }) => (
            <ListCard
              title={item.fullName || item.email}
              subtitle={item.email}
              meta={`${roleLabel(item.role)} · ${item.performanceLabel} · ${formatInrFull(item.turnoverInr)}`}
              onPress={() => router.push(`/(app)/employees/${item.id}` as Href)}
            />
          )}
          ListEmptyComponent={<EmptyState>No employees found.</EmptyState>}
        />
      )}
    </ConsoleScreenLayout>
  );
}

export function EmployeeDetailPage({ employeeId }: { employeeId: string }) {
  const [detail, setDetail] = useState<{
    employee: Employee;
    recentLeads: Array<{ id: string; name: string; crop: string; when: string }>;
    recentTasks: Array<{ id: string; title: string; status: string }>;
  } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{
      ok: boolean;
      employee: Employee;
      recentLeads: Array<{ id: string; name: string; crop: string; when: string }>;
      recentTasks: Array<{ id: string; title: string; status: string }>;
    }>(`/morbeez-staff/api/v1/staff/${employeeId}`)
      .then((d) =>
        setDetail({
          employee: d.employee,
          recentLeads: d.recentLeads ?? [],
          recentTasks: d.recentTasks ?? [],
        })
      )
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load employee'))
      .finally(() => setLoading(false));
  }, [employeeId]);

  if (loading) {
    return (
      <ConsoleScreenLayout title="Employee Details">
        <Loading label="Loading employee…" />
      </ConsoleScreenLayout>
    );
  }

  if (error || !detail) {
    return (
      <ConsoleScreenLayout title="Employee Details">
        <Alert>{error || 'Employee not found'}</Alert>
      </ConsoleScreenLayout>
    );
  }

  const e = detail.employee;

  return (
    <ConsoleScreenLayout title={e.fullName || e.email}>
      <Panel title="Profile">
        <View style={styles.badges}>
          <Badge tone="role">{roleLabel(e.role)}</Badge>
          <Badge tone={e.active ? 'active' : 'archived'}>{e.active ? 'Active' : 'Inactive'}</Badge>
        </View>
        <ListCard title="Performance" subtitle={e.performanceLabel} meta={`Score ${e.performanceScore}`} />
        <ListCard title="Turnover" subtitle={formatInrFull(e.turnoverInr)} meta={`${e.pendingTasks} pending tasks`} />
      </Panel>
      <Panel title="Recent leads">
        {detail.recentLeads.map((l) => (
          <ListCard key={l.id} title={l.name} subtitle={l.crop} meta={l.when} />
        ))}
      </Panel>
      <Panel title="Recent tasks">
        {detail.recentTasks.map((t) => (
          <ListCard key={t.id} title={t.title} meta={t.status} />
        ))}
      </Panel>
    </ConsoleScreenLayout>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  badges: { flexDirection: 'row', gap: 8, marginBottom: 12 },
});
