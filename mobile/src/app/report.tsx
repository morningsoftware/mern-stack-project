import { useRef, useState } from 'react';
import { Platform, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Choices, Field, Notice, Screen, styles } from '../components/ui';
import { api } from '../lib/session';
import { bugPayload, severities } from '../lib/models';
import type { Bug, Build, Project } from '../lib/models';
import { useResource } from '../lib/useResource';
export default function Report() {
  const { projectId, buildId } = useLocalSearchParams<{ projectId: string; buildId?: string }>();
  const project = useResource<Project>(projectId ? `/api/projects/${encodeURIComponent(projectId)}` : null);
  const builds = useResource<Build[]>(projectId ? `/api/builds?projectId=${encodeURIComponent(projectId)}` : null);
  const [form, setForm] = useState<Record<string, string>>({ title: '', description: '', reproductionSteps: '', expectedResult: '', actualResult: '', environment: `${Platform.OS} ${Platform.Version}`, severity: 'medium', buildId: buildId || '' });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const created = useRef<string | null>(null);
  const update = (name: string, value: string) => setForm(f => ({ ...f, [name]: value }));
  async function submit() {
    if (lock.current) return;
    if (created.current) { router.replace({ pathname: '/bug/[id]', params: { id: created.current, created: 'yes' } }); return; }
    lock.current = true; setPending(true); setError('');
    try {
      const body = bugPayload(form, projectId);
      const bug = await api.request<Bug>('/api/bug-reports', { method: 'POST', body: JSON.stringify(body) });
      // Attachment is a separate step, so a failed image upload never resubmits the report.
      created.current = bug._id;
      router.replace({ pathname: '/bug/[id]', params: { id: bug._id, created: 'yes' } });
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save the report.'); }
    finally { lock.current = false; setPending(false); }
  }
  return <Screen title="Report a bug">
    <Text style={styles.text}>{project.data?.name || 'Loading project…'}</Text>
    <Text style={styles.muted}>Describe one reproducible issue. You can attach screenshots after saving.</Text>
    <Notice text={error || project.error || builds.error} error />
    <Card>
      <Text style={styles.text}>Build</Text>
      <Button title="General project issue" secondary selected={!form.buildId} disabled={pending} onPress={() => update('buildId', '')} />
      {builds.data?.map(build => <Button key={build._id} title={`Build ${build.version} · ${build.platform}`} secondary selected={form.buildId === build._id} disabled={pending} onPress={() => update('buildId', build._id)} />)}
      <Field label="Bug title" value={form.title} onChangeText={v => update('title', v)} maxLength={200} editable={!pending} />
      <Choices label="Severity" values={severities} value={form.severity} onChange={v => update('severity', v)} disabled={pending} />
      <Field label="Steps to reproduce" multiline value={form.reproductionSteps} onChangeText={v => update('reproductionSteps', v)} maxLength={5000} editable={!pending} />
      <Field label="Expected result" multiline value={form.expectedResult} onChangeText={v => update('expectedResult', v)} maxLength={5000} editable={!pending} />
      <Field label="Actual result" multiline value={form.actualResult} onChangeText={v => update('actualResult', v)} maxLength={5000} editable={!pending} />
      <Field label="Device, OS and input method" value={form.environment} onChangeText={v => update('environment', v)} maxLength={500} editable={!pending} />
      <Field label="Extra notes (optional)" multiline value={form.description} onChangeText={v => update('description', v)} maxLength={5000} editable={!pending} />
      <Button title="Submit bug report" busy={pending} disabled={!project.data || !!form.buildId && !builds.data?.some(b => b._id === form.buildId)} onPress={() => { void submit(); }} />
    </Card>
    <Button title="Back without submitting" secondary disabled={pending} onPress={() => router.back()} />
  </Screen>;
}
