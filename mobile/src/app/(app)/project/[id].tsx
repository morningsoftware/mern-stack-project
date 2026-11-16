import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Banner, BuildCard, Button, EmptyState, ErrorState, Screen, SegmentedTabs, SessionCard, SkeletonList, StatusBadge } from '../../../components';
import { useNow } from '../../../lib/hooks';
import { safeBuildUrl } from '../../../lib/format';
import { sessionOpen } from '../../../lib/models';
import type { Build, Project, Session } from '../../../lib/models';
import { useResource } from '../../../lib/useResource';
import { space, text } from '../../../theme';

type View_ = 'builds' | 'sessions';

export default function ProjectPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = useResource<Project>(id ? `/api/projects/${encodeURIComponent(id)}` : null);
  const builds = useResource<Build[]>(id ? `/api/builds?projectId=${encodeURIComponent(id)}` : null);
  const sessions = useResource<Session[]>(id ? `/api/playtest-sessions?projectId=${encodeURIComponent(id)}` : null);
  const [view, setView] = useState<View_>('builds');
  const [opening, setOpening] = useState('');
  const [openError, setOpenError] = useState('');
  const now = useNow();

  const refresh = () => { project.reload(); builds.reload(); sessions.reload(); };
  const refreshing = project.refreshing || builds.refreshing || sessions.refreshing;
  const openSessions = (sessions.data ?? []).filter(session => sessionOpen(session, now)).length;
  const buildLabel = (buildId: string) => {
    const build = builds.data?.find(item => item._id === buildId);
    return build ? `Build ${build.version}` : '';
  };

  async function openBuild(build: Build) {
    setOpenError(''); setOpening(build._id);
    try { await Linking.openURL(safeBuildUrl(build.downloadUrl)); }
    catch (err) { setOpenError(err instanceof Error ? err.message : 'Could not open this build. Try again.'); }
    finally { setOpening(''); }
  }

  const toFeedback = (params: Record<string, string>) => router.push({ pathname: '/feedback', params: { projectId: id, ...params } });
  const toReport = (params: Record<string, string> = {}) => router.push({ pathname: '/report', params: { projectId: id, ...params } });

  if (project.error && !project.data) return <Screen><ErrorState message={project.error} onRetry={project.reload} title="Could not load this project" /></Screen>;

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Stack.Screen options={{ title: project.data?.name ?? 'Project' }} />
      {project.data ? (
        <View style={styles.header}>
          <Text accessibilityRole="header" style={text.title}>{project.data.name}</Text>
          <StatusBadge status={project.data.status} />
          {project.data.description ? <Text style={text.body}>{project.data.description}</Text> : null}
        </View>
      ) : <SkeletonList count={1} label="Loading project" />}

      <View style={styles.actions}>
        <Button title="Report a bug" onPress={() => toReport()} style={styles.action} />
        <Button title="Send feedback" variant="secondary" onPress={() => toFeedback({})} style={styles.action} />
      </View>

      <SegmentedTabs<View_> value={view} onChange={setView} options={[
        { value: 'builds', label: 'Builds', count: builds.data?.length },
        { value: 'sessions', label: 'Sessions', count: openSessions || undefined },
      ]} />
      <Banner tone="error" message={openError} />

      {view === 'builds' ? (
        <View style={styles.list}>
          {builds.loading && !builds.data ? <SkeletonList label="Loading builds" /> : null}
          {builds.error && !builds.data ? <ErrorState message={builds.error} onRetry={builds.reload} title="Could not load builds" /> : null}
          {builds.data?.length === 0 ? <EmptyState title="No builds yet" body="The team has not published a build for this project. You can still send general feedback or report a bug." actionLabel="Send general feedback" onAction={() => toFeedback({})} /> : null}
          {builds.data?.map(build => (
            <BuildCard key={build._id} build={build} opening={opening === build._id} onOpen={() => openBuild(build)}
              onFeedback={() => toFeedback({ buildId: build._id })} onReport={() => toReport({ buildId: build._id })} />
          ))}
        </View>
      ) : (
        <View style={styles.list}>
          {sessions.loading && !sessions.data ? <SkeletonList label="Loading sessions" /> : null}
          {sessions.error && !sessions.data ? <ErrorState message={sessions.error} onRetry={sessions.reload} title="Could not load sessions" /> : null}
          {sessions.data?.length === 0 ? <EmptyState title="No scheduled sessions" body="Sessions give testers a build, instructions and a deadline. Until one is scheduled, test any build and send general feedback." /> : null}
          {sessions.data?.map(session => (
            <SessionCard key={session._id} session={session} now={now} buildLabel={buildLabel(session.buildId)}
              onFeedback={() => toFeedback({ sessionId: session._id, buildId: session.buildId })} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1 },
  list: { gap: space.md },
});
