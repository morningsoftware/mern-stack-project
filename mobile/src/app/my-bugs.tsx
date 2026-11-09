import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Heading, Notice, Screen, styles } from '../components/ui';
import { ownBugs } from '../lib/models';
import type { Bug } from '../lib/models';
import { useSession } from '../lib/session';
import { useResource } from '../lib/useResource';
export default function MyBugs() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { user } = useSession();
  const bugs = useResource<Bug[]>(projectId ? `/api/bug-reports?projectId=${encodeURIComponent(projectId)}` : null);
  const rows = ownBugs(bugs.data || [], user?._id || '');
  return <Screen title="My bug reports" refresh={bugs.reload} refreshing={bugs.loading}>
    <Text style={styles.text}>Follow the reports you submitted for this project.</Text>
    <Notice text={bugs.error} error />
    {bugs.loading && <Text style={styles.text}>Loading your reports…</Text>}
    {!bugs.loading && bugs.data && rows.length === 0 && <Text style={styles.text}>You have not reported a bug in this project yet.</Text>}
    {rows.map(bug => <Card key={bug._id}><Heading>{bug.title}</Heading><Text style={styles.text}>Status: {bug.status} · Severity: {bug.severity}</Text><Button title={`View report: ${bug.title}`} secondary onPress={() => router.push({ pathname: '/bug/[id]', params: { id: bug._id } })} /></Card>)}
    <Button title="Report another bug" onPress={() => router.push({ pathname: '/report', params: { projectId } })} />
    <Button title="Refresh reports" secondary onPress={bugs.reload} busy={bugs.loading} />
  </Screen>;
}
