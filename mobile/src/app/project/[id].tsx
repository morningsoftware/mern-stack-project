import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Heading, Notice, Screen, styles } from '../../components/ui';
import { useResource } from '../../lib/useResource';
import { sessionOpen } from '../../lib/models';
import type { Build, Project, Session } from '../../lib/models';
export default function ProjectPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = useResource<Project>(id ? `/api/projects/${encodeURIComponent(id)}` : null);
  const builds = useResource<Build[]>(id ? `/api/builds?projectId=${encodeURIComponent(id)}` : null);
  const sessions = useResource<Session[]>(id ? `/api/playtest-sessions?projectId=${encodeURIComponent(id)}` : null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const refresh = () => { project.reload(); builds.reload(); sessions.reload(); setNow(Date.now()); };
  async function openBuild(url: string) {
    try { const parsed = new URL(url); if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('This build needs a valid HTTPS link.'); await Linking.openURL(parsed.href); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not open this build.'); }
  }
  return <Screen title={project.data?.name || 'Project playtesting'} refresh={refresh} refreshing={project.loading || builds.loading || sessions.loading}>
    <Notice text={project.error || builds.error || sessions.error || error} error />
    <Text style={styles.text}>{project.data?.description}</Text>
    <View style={styles.row}><Button title="Report a bug" onPress={() => router.push({ pathname: '/report', params: { projectId: id } })} /><Button title="My bug reports" secondary onPress={() => router.push({ pathname: '/my-bugs', params: { projectId: id } })} /></View>
    <Heading>Playtest sessions</Heading>
    {sessions.loading && <Text style={styles.text}>Loading sessions…</Text>}
    {sessions.data?.length === 0 && <Text style={styles.text}>No scheduled sessions. You can still test a build and leave general feedback.</Text>}
    {sessions.data?.map(session => <Card key={session._id}><Heading>{session.title}</Heading><Text style={styles.text}>{session.instructions}</Text><Text style={styles.muted}>{sessionOpen(session, now) ? 'Open' : session.status === 'closed' ? 'Closed' : 'Deadline passed'} · {new Date(session.deadline).toLocaleString()}</Text><Text style={styles.muted}>Build {builds.data?.find(b => b._id === session.buildId)?.version || session.buildId}</Text>
      <Button title={`Give feedback: ${session.title}`} disabled={!sessionOpen(session, now)} onPress={() => router.push({ pathname: '/feedback', params: { projectId: id, sessionId: session._id, buildId: session.buildId } })} />
    </Card>)}
    <Heading>Available builds</Heading>
    {builds.loading && <Text style={styles.text}>Loading builds…</Text>}
    {builds.data?.length === 0 && <Text style={styles.text}>No builds published yet. Ask the team to add one in the desktop workspace.</Text>}
    {builds.data?.map(build => <Card key={build._id}><Heading>{build.version} · {build.platform}</Heading><Text style={styles.text}>{build.releaseNotes || 'No release notes.'}</Text>
      <Button title={`Open build ${build.version}`} secondary onPress={() => { void openBuild(build.downloadUrl); }} />
      <Text style={styles.muted}>Opens the published link in your browser. Desktop builds may require a computer.</Text>
      <View style={styles.row}><Button title={`Feedback for ${build.version}`} onPress={() => router.push({ pathname: '/feedback', params: { projectId: id, buildId: build._id } })} /><Button title={`Bug in ${build.version}`} secondary onPress={() => router.push({ pathname: '/report', params: { projectId: id, buildId: build._id } })} /></View>
    </Card>)}
    <Button title="General project feedback" secondary onPress={() => router.push({ pathname: '/feedback', params: { projectId: id } })} />
    <Button title="Refresh project" secondary onPress={refresh} busy={project.loading || builds.loading || sessions.loading} />
    <Button title="All projects" secondary onPress={() => router.replace('/projects')} />
  </Screen>;
}
