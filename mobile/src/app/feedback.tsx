import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Choices, Field, Notice, Screen, styles } from '../components/ui';
import { api } from '../lib/session';
import { useResource } from '../lib/useResource';
import { sessionOpen } from '../lib/models';
import type { Build, Project, Session } from '../lib/models';
export default function Feedback() {
  const { projectId, sessionId, buildId } = useLocalSearchParams<{ projectId: string; sessionId?: string; buildId?: string }>();
  const project = useResource<Project>(projectId ? `/api/projects/${encodeURIComponent(projectId)}` : null);
  const session = useResource<Session>(sessionId ? `/api/playtest-sessions/${encodeURIComponent(sessionId)}` : null);
  const build = useResource<Build>(buildId ? `/api/builds/${encodeURIComponent(buildId)}` : null);
  const [rating, setRating] = useState('3');
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lock = useRef(false);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const closed = !!sessionId && (!session.data || !sessionOpen(session.data, now));
  async function submit() {
    if (lock.current || saved) return;
    if (!projectId || !comments.trim()) { setError('Add a short description of your playtest.'); return; }
    lock.current = true; setPending(true); setError('');
    try {
      // Re-read before writing; the API independently checks the deadline at submission.
      if (sessionId) {
        const fresh = await api.request<Session>(`/api/playtest-sessions/${encodeURIComponent(sessionId)}`);
        if (!sessionOpen(fresh)) throw new Error('This session is closed or its deadline has passed. Your feedback is still in the form.');
      }
      await api.request('/api/playtest-feedback', { method: 'POST', body: JSON.stringify({ projectId, ...(buildId ? { buildId } : {}), ...(sessionId ? { sessionId } : {}), rating: Number(rating), comments: comments.trim() }) });
      setSaved(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not send feedback.'); }
    finally { lock.current = false; setPending(false); }
  }
  return <Screen title="Share playtest feedback">
    <Text style={styles.text}>{project.data?.name || 'Loading project…'}{build.data ? ` · Build ${build.data.version}` : ''}</Text>
    <Notice text={error || project.error || session.error || build.error} error />
    {saved ? <Card><Notice text="Feedback sent. The team can review it in the desktop workspace." /><Button title="Back to project" onPress={() => router.replace({ pathname: '/project/[id]', params: { id: projectId } })} /></Card> : <Card>
      {session.data && <Text style={styles.text}>{session.data.title}: {session.data.instructions}</Text>}
      {closed && <Notice text="This session is unavailable, closed or past its deadline. Refresh to check again." error />}
      <Choices label="Rating: 1 (poor) to 5 (great)" values={['1', '2', '3', '4', '5']} value={rating} onChange={setRating} disabled={pending} />
      <Field label="What worked, and what needs attention?" multiline maxLength={5000} value={comments} onChangeText={setComments} editable={!pending} />
      <Button title="Send feedback" busy={pending} disabled={closed || !project.data || !!buildId && !build.data} onPress={() => { void submit(); }} />
      {sessionId && <Button title="Refresh session" secondary busy={session.loading} onPress={session.reload} />}
    </Card>}
    {!saved && <Button title="Back without sending" secondary disabled={pending} onPress={() => router.back()} />}
  </Screen>;
}
