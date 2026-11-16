import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Banner, BuildPicker, Button, Card, ErrorState, Field, RatingInput, Screen } from '../../components';
import { useDiscardGuard, useNow } from '../../lib/hooks';
import { feedbackPayload, sessionOpen } from '../../lib/models';
import type { Build, Project, Session } from '../../lib/models';
import { api } from '../../lib/session';
import { useResource } from '../../lib/useResource';
import { colors, space, text } from '../../theme';

export default function Feedback() {
  const { projectId, sessionId, buildId: initialBuild } = useLocalSearchParams<{ projectId: string; sessionId?: string; buildId?: string }>();
  const project = useResource<Project>(projectId ? `/api/projects/${encodeURIComponent(projectId)}` : null);
  const session = useResource<Session>(sessionId ? `/api/playtest-sessions/${encodeURIComponent(sessionId)}` : null);
  const builds = useResource<Build[]>(projectId ? `/api/builds?projectId=${encodeURIComponent(projectId)}` : null);
  const [buildId, setBuildId] = useState(initialBuild ?? '');
  const [rating, setRating] = useState<number | null>(null);
  const [comments, setComments] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const now = useNow();
  const dirty = !saved && (rating !== null || comments.trim().length > 0);
  const allowLeave = useDiscardGuard(dirty);

  const closed = !!sessionId && !!session.data && !sessionOpen(session.data, now);
  const errors = { rating: rating === null ? 'Choose a rating from 1 to 5.' : '', comments: comments.trim() ? '' : 'Add a short description of your playtest.' };
  const buildLocked = !!sessionId;

  async function submit() {
    if (lock.current || saved) return;
    setTouched(true);
    if (errors.rating || errors.comments) { setError('Fix the highlighted fields to send your feedback.'); return; }
    lock.current = true; setPending(true); setError('');
    try {
      // The API enforces the deadline too; re-reading first gives a clearer message.
      if (sessionId) {
        const fresh = await api.request<Session>(`/api/playtest-sessions/${encodeURIComponent(sessionId)}`);
        if (!sessionOpen(fresh)) throw new Error('This session is closed or its deadline has passed. Your feedback is still in the form.');
      }
      await api.request('/api/playtest-feedback', { method: 'POST', body: JSON.stringify(feedbackPayload({ projectId, buildId, sessionId, rating, comments })) });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send feedback. Your answers are still here, so try again.');
    } finally {
      lock.current = false; setPending(false);
    }
  }

  const toProject = () => { allowLeave(); router.replace({ pathname: '/project/[id]', params: { id: projectId } }); };

  if (project.error && !project.data) return <Screen><ErrorState message={project.error} onRetry={project.reload} title="Could not load this project" /></Screen>;

  if (saved) {
    return (
      <Screen>
        <Card>
          <Text accessibilityRole="header" style={text.title}>Feedback sent</Text>
          <Banner tone="success" message="Thanks. The team can review your feedback in the desktop workspace." />
          <Button title="Report a bug too" variant="secondary" onPress={() => { router.replace({ pathname: '/report', params: { projectId, ...(buildId ? { buildId } : {}) } }); }} />
          <Button title="Back to project" onPress={toProject} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen keyboard>
      <View style={{ gap: space.xs }}>
        <Text accessibilityRole="header" style={text.title}>Share feedback</Text>
        <Text style={text.body}>{project.data?.name ?? 'Loading project…'}</Text>
      </View>
      {session.data ? (
        <Card>
          <Text style={text.subheading}>{session.data.title}</Text>
          <Text style={text.body}>{session.data.instructions}</Text>
        </Card>
      ) : null}
      <Banner tone="error" message={closed ? 'This session is closed or past its deadline, so feedback cannot be sent right now.' : session.error || builds.error} actionLabel={session.error ? 'Refresh session' : undefined} onAction={session.reload} />
      <Card>
        <Banner tone="error" message={error} />
        {builds.data && builds.data.length > 0 && !buildLocked ? <BuildPicker builds={builds.data} value={buildId} onChange={setBuildId} disabled={pending} noneLabel="General, not tied to one build" /> : null}
        {buildLocked && builds.data ? <Text style={text.small}>Build: {builds.data.find(build => build._id === buildId)?.version ?? 'Session build'}</Text> : null}
        <RatingInput value={rating} onChange={value => { setRating(value); setError(''); }} disabled={pending} error={touched ? errors.rating : ''} />
        <Field label="What worked, and what needs attention?" multiline maxLength={5000} value={comments} onChangeText={value => { setComments(value); setError(''); }}
          onBlur={() => setTouched(true)} error={touched ? errors.comments : ''} editable={!pending} placeholder="Describe what you played and how it felt." />
        <Button title="Send feedback" busy={pending} busyLabel="Sending…" disabled={closed || !project.data} onPress={submit} />
      </Card>
      <Text style={styles.footnote}>Saw something broken? Report a bug instead, with steps and a screenshot.</Text>
      <Button title="Report a bug" variant="secondary" disabled={pending} onPress={() => { router.replace({ pathname: '/report', params: { projectId, ...(buildId ? { buildId } : {}) } }); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({ footnote: { fontSize: 14, color: colors.muted } });
