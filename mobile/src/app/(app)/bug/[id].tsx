import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthImage, Banner, Button, Card, ErrorState, Screen, ScreenshotPicker, Section, SeverityBadge, SkeletonList, StatusBadge, StatusTrack } from '../../../components';
import { confirmAction } from '../../../lib/hooks';
import { formatBytes, formatDateTime, relativeTime } from '../../../lib/format';
import { MAX_SCREENSHOTS } from '../../../lib/images';
import type { Build, Bug, Project, Screenshot } from '../../../lib/models';
import { api, useSession } from '../../../lib/session';
import { useImageQueue } from '../../../lib/uploads';
import { useResource } from '../../../lib/useResource';
import { colors, space, text } from '../../../theme';

const details = [
  ['reproductionSteps', 'Steps to reproduce'],
  ['expectedResult', 'Expected'],
  ['actualResult', 'Actual'],
  ['environment', 'Environment'],
  ['description', 'Notes'],
] as const;

export default function BugPage() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const { user } = useSession();
  const bug = useResource<Bug>(id ? `/api/bug-reports/${encodeURIComponent(id)}` : null);
  const mine = !!bug.data && bug.data.reportedBy === user?._id;
  const project = useResource<Project>(bug.data ? `/api/projects/${encodeURIComponent(bug.data.projectId)}` : null);
  const builds = useResource<Build[]>(bug.data ? `/api/builds?projectId=${encodeURIComponent(bug.data.projectId)}` : null);
  const screenshots = useResource<Screenshot[]>(mine ? `/api/bug-reports/${encodeURIComponent(id)}/screenshots` : null);
  const queue = useImageQueue(Math.max(0, MAX_SCREENSHOTS - (screenshots.data?.length ?? 0)));
  const [viewing, setViewing] = useState<Screenshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const refresh = () => { bug.reload(); screenshots.reload(); project.reload(); builds.reload(); };
  const build = builds.data?.find(item => item._id === bug.data?.buildId);
  const attached = screenshots.data?.length ?? 0;
  const slots = MAX_SCREENSHOTS - attached;
  const imagePath = (shot: Screenshot) => `/api/bug-reports/${encodeURIComponent(id)}/screenshots/${encodeURIComponent(shot._id)}`;

  async function attach() {
    setMessage(null);
    const { done, failed } = await queue.upload(id);
    if (done > 0) { queue.clear(); screenshots.reload(); }
    if (failed > 0) setMessage({ tone: 'error', text: `${failed === 1 ? '1 screenshot' : `${failed} screenshots`} did not upload. Your report is safe. Retry when your connection is better.` });
    else if (done > 0) setMessage({ tone: 'success', text: done === 1 ? 'Screenshot attached.' : `${done} screenshots attached.` });
  }

  async function remove(shot: Screenshot) {
    if (busy) return;
    if (!(await confirmAction('Remove this screenshot?', 'It will be removed from the report for everyone.', 'Remove'))) return;
    setBusy(true); setMessage(null);
    try {
      await api.request(imagePath(shot), { method: 'DELETE' });
      setViewing(null); screenshots.reload();
      setMessage({ tone: 'success', text: 'Screenshot removed.' });
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not remove the screenshot. Try again.' });
    } finally { setBusy(false); }
  }

  if (bug.error && !bug.data) return <Screen><ErrorState message={bug.error} onRetry={bug.reload} title="Could not load this report" /></Screen>;
  if (!bug.data) return <Screen><SkeletonList count={2} label="Loading report" /></Screen>;
  const data = bug.data;
  const meta = [project.data?.name, build ? `Build ${build.version}` : '', data.createdOn ? `Reported ${relativeTime(data.createdOn)}` : ''].filter(Boolean).join(' · ');

  return (
    <Screen onRefresh={refresh} refreshing={bug.refreshing}>
      {created === 'yes' ? <Banner tone="success" message="Report submitted. The team will see it in the desktop workspace." /> : null}
      <Banner tone="error" message={bug.error ? `Could not refresh. ${bug.error}` : ''} actionLabel="Try again" onAction={bug.reload} />
      <View style={{ gap: space.sm }}>
        <Text accessibilityRole="header" style={text.title}>{data.title}</Text>
        <View style={styles.badges}><StatusBadge status={data.status} /><SeverityBadge severity={data.severity} /></View>
        {meta ? <Text style={text.small}>{meta}</Text> : null}
      </View>

      <Card>
        <Text style={text.label}>Status</Text>
        <StatusTrack status={data.status} />
        <Text style={text.small}>The team updates this as they work on your report. Pull down to check for changes.</Text>
      </Card>

      <Card>
        {details.map(([key, label]) => data[key] ? (
          <View key={key} style={{ gap: 2 }}>
            <Text style={text.label}>{label}</Text>
            <Text selectable style={text.body}>{data[key]}</Text>
          </View>
        ) : null)}
        {data.createdOn ? <Text style={text.small}>Submitted {formatDateTime(data.createdOn)}</Text> : null}
        <Text style={text.mono} selectable>Report {data._id}</Text>
      </Card>

      {mine ? (
        <Section title="Screenshots" aside={`${attached}/${MAX_SCREENSHOTS}`}>
          <Banner tone={message?.tone ?? 'info'} message={message?.text} />
          {screenshots.error ? <ErrorState message={screenshots.error} onRetry={screenshots.reload} title="Could not load screenshots" /> : null}
          {screenshots.loading && !screenshots.data ? <SkeletonList count={1} label="Loading screenshots" /> : null}
          {attached > 0 ? (
            <View style={styles.grid}>
              {screenshots.data?.map((shot, index) => (
                <Pressable key={shot._id} accessibilityRole="button" accessibilityLabel={`Open screenshot ${index + 1}, ${formatBytes(shot.size)}`} onPress={() => setViewing(shot)} style={styles.cell}>
                  <AuthImage path={imagePath(shot)} label={`Screenshot ${index + 1}`} style={StyleSheet.absoluteFill} />
                </Pressable>
              ))}
            </View>
          ) : null}
          {screenshots.data && attached === 0 && queue.images.length === 0 ? <Text style={text.body}>No screenshots yet. A picture of the problem helps the team a lot.</Text> : null}
          {slots > 0 ? (
            <>
              <ScreenshotPicker images={queue.images} onPick={queue.pick} onRemove={queue.remove} error={queue.pickError} max={slots} disabled={queue.uploading || busy}
                hint="Choose PNG, JPEG or WebP images up to 2 MB each. Only you and the project team can see them." />
              {queue.images.length > 0 ? <Button title={queue.images.some(image => image.status === 'error') ? 'Retry upload' : 'Attach screenshots'} busy={queue.uploading} busyLabel="Uploading…" onPress={attach} /> : null}
            </>
          ) : <Text style={text.small}>This report has the maximum of {MAX_SCREENSHOTS} screenshots. Remove one to add another.</Text>}
        </Section>
      ) : null}

      <Button title="My reports" variant="secondary" onPress={() => router.navigate('/reports')} />
      <Button title="Back to project" variant="secondary" onPress={() => router.navigate({ pathname: '/project/[id]', params: { id: data.projectId } })} />

      <Viewer shot={viewing} path={viewing ? imagePath(viewing) : ''} busy={busy} onClose={() => setViewing(null)} onRemove={() => viewing && remove(viewing)} />
    </Screen>
  );
}

function Viewer({ shot, path, busy, onClose, onRemove }: { shot: Screenshot | null; path: string; busy: boolean; onClose: () => void; onRemove: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!shot} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.viewer, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md }]}>
        {shot ? <AuthImage path={path} label="Screenshot preview" resizeMode="contain" style={styles.viewerImage} /> : null}
        {shot ? <Text style={styles.viewerMeta}>{shot.contentType.replace('image/', '').toUpperCase()} · {formatBytes(shot.size)}</Text> : null}
        <View style={styles.viewerActions}>
          <Button title="Remove" variant="danger" onPress={onRemove} busy={busy} style={{ flex: 1 }} />
          <Button title="Close" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { width: '31.5%', aspectRatio: 1, borderRadius: 4 },
  viewer: { flex: 1, backgroundColor: '#161d18', paddingHorizontal: space.lg, gap: space.md },
  viewerImage: { flex: 1, backgroundColor: 'transparent', borderColor: colors.forestRaised },
  viewerMeta: { fontSize: 14, color: colors.onForestMuted, textAlign: 'center' },
  viewerActions: { flexDirection: 'row', gap: space.sm },
});
