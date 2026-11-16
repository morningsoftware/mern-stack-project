import { useCallback, useMemo, useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { Banner, EmptyState, ErrorState, ReportCard, Screen, SegmentedTabs, SkeletonList } from '../../../components';
import { useNow, useRefreshOnFocus } from '../../../lib/hooks';
import { countBugsByStatus, filterBugs, ownBugs } from '../../../lib/models';
import type { Bug, BugStatus, Project } from '../../../lib/models';
import { useSession } from '../../../lib/session';
import { useResource } from '../../../lib/useResource';
import { formatStatus } from '../../../lib/format';
import { text } from '../../../theme';

type Filter = BugStatus | 'all';

export default function MyReports() {
  const { user } = useSession();
  const bugs = useResource<Bug[]>('/api/bug-reports');
  const projects = useResource<Project[]>('/api/projects');
  const [filter, setFilter] = useState<Filter>('all');
  const now = useNow(60000);
  const reloadBugs = bugs.reload;
  const reloadProjects = projects.reload;
  // Must be stable: useRefreshOnFocus re-runs whenever its callback changes.
  const reload = useCallback(() => { reloadBugs(); reloadProjects(); }, [reloadBugs, reloadProjects]);
  useRefreshOnFocus(reload);

  const mine = useMemo(() => ownBugs(bugs.data ?? [], user?._id ?? ''), [bugs.data, user?._id]);
  const counts = useMemo(() => countBugsByStatus(mine), [mine]);
  const rows = useMemo(() => filterBugs(mine, filter), [mine, filter]);
  const names = useMemo(() => new Map((projects.data ?? []).map(project => [project._id, project.name])), [projects.data]);

  return (
    <Screen bottomInset={false} onRefresh={reload} refreshing={bugs.refreshing || projects.refreshing}>
      <Text style={text.body}>Bugs you reported, with their current status from the team.</Text>
      {bugs.data ? (
        <SegmentedTabs<Filter> value={filter} onChange={setFilter} options={[
          { value: 'all', label: 'All', count: counts.all },
          { value: 'open', label: 'Open', count: counts.open },
          { value: 'in_progress', label: 'Active', count: counts.in_progress },
          { value: 'resolved', label: 'Done', count: counts.resolved },
        ]} />
      ) : null}
      {bugs.loading && !bugs.data ? <SkeletonList label="Loading your reports" /> : null}
      {bugs.error && !bugs.data ? <ErrorState message={bugs.error} onRetry={reload} title="Could not load your reports" /> : null}
      {bugs.error && bugs.data ? <Banner tone="error" message={`Could not refresh. ${bugs.error}`} actionLabel="Try again" onAction={reload} /> : null}
      {bugs.data && mine.length === 0 ? (
        <EmptyState title="No reports yet" body="When you find a bug in a build, report it from the project page. Your reports and their status will show up here." actionLabel="Browse projects" onAction={() => router.navigate('/projects')} />
      ) : null}
      {bugs.data && mine.length > 0 && rows.length === 0 ? (
        <EmptyState title={`Nothing ${formatStatus(filter).toLowerCase()}`} body="None of your reports have this status right now." actionLabel="Show all reports" onAction={() => setFilter('all')} />
      ) : null}
      {rows.map(bug => (
        <ReportCard key={bug._id} bug={bug} projectName={names.get(bug.projectId)} now={now}
          onPress={() => router.push({ pathname: '/bug/[id]', params: { id: bug._id } })} />
      ))}
    </Screen>
  );
}
