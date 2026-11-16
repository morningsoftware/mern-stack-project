import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Banner, BuildPicker, Button, Card, ChoiceGroup, ErrorState, Field, Screen, ScreenshotPicker } from '../../components';
import { deviceSummary } from '../../lib/format';
import { useDiscardGuard } from '../../lib/hooks';
import { bugErrors, bugPayload, severities } from '../../lib/models';
import type { Bug, Build, Project } from '../../lib/models';
import { api } from '../../lib/session';
import { useImageQueue } from '../../lib/uploads';
import { useResource } from '../../lib/useResource';
import { space, text } from '../../theme';

type Form = Record<string, string>;
const severityOptions = severities.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }));

export default function Report() {
  const { projectId, buildId } = useLocalSearchParams<{ projectId: string; buildId?: string }>();
  const project = useResource<Project>(projectId ? `/api/projects/${encodeURIComponent(projectId)}` : null);
  const builds = useResource<Build[]>(projectId ? `/api/builds?projectId=${encodeURIComponent(projectId)}` : null);
  const initialEnvironment = useMemo(() => deviceSummary(Platform.OS, Platform.OS === 'web' ? undefined : Platform.Version), []);
  const [form, setForm] = useState<Form>({ title: '', reproductionSteps: '', expectedResult: '', actualResult: '', environment: initialEnvironment, description: '', severity: 'medium', buildId: buildId ?? '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [banner, setBanner] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const queue = useImageQueue();
  const lock = useRef(false);

  const errors = bugErrors(form);
  const dirty = createdId === null && (queue.images.length > 0 || Object.entries(form).some(([key, value]) => !['severity', 'buildId', 'environment'].includes(key) && value.trim() !== '') || form.environment !== initialEnvironment);
  const allowLeave = useDiscardGuard(dirty);
  const failedUploads = queue.images.filter(image => image.status === 'error').length;
  const locked = pending || queue.uploading || createdId !== null;

  // Stable handlers keep typing cheap: only the edited field re-renders.
  const update = useCallback((name: string, value: string) => {
    setForm(current => ({ ...current, [name]: value }));
    setBanner(current => (current?.tone === 'error' ? null : current));
  }, []);
  const blur = useCallback((name: string) => setTouched(current => (current[name] ? current : { ...current, [name]: true })), []);
  const pickBuild = useCallback((value: string) => update('buildId', value), [update]);
  const pickSeverity = useCallback((value: string) => update('severity', value), [update]);
  const shown = (name: keyof typeof errors) => (touched[name] || touched.__submit ? errors[name] ?? '' : '');

  function viewReport(id: string) {
    allowLeave();
    router.replace({ pathname: '/bug/[id]', params: { id, created: 'yes' } });
  }

  async function submit() {
    if (lock.current) return;
    lock.current = true; setPending(true);
    try {
      let id = createdId;
      if (id === null) {
        setTouched(current => ({ ...current, __submit: true }));
        if (Object.keys(errors).length) { setBanner({ tone: 'error', message: 'Fix the highlighted fields to submit your report.' }); return; }
        try {
          const bug = await api.request<Bug>('/api/bug-reports', { method: 'POST', body: JSON.stringify(bugPayload(form, projectId)) });
          id = bug._id;
          setCreatedId(id);
        } catch (err) {
          setBanner({ tone: 'error', message: err instanceof Error ? `${err.message} Your report is still here, so try again.` : 'Could not save the report. Try again.' });
          return;
        }
      }
      // Screenshots upload after the report exists, so a failed upload can never create a duplicate report.
      if (queue.images.some(image => image.status !== 'done')) {
        const { failed } = await queue.upload(id);
        if (failed > 0) {
          setBanner({ tone: 'error', message: `Your report was saved, but ${failed === 1 ? '1 screenshot' : `${failed} screenshots`} did not upload. Retry the upload, or view your report and add it later.` });
          return;
        }
      }
      viewReport(id);
    } finally {
      lock.current = false; setPending(false);
    }
  }

  if (project.error && !project.data) return <Screen><ErrorState message={project.error} onRetry={project.reload} title="Could not load this project" /></Screen>;

  const submitLabel = createdId === null ? 'Submit bug report' : failedUploads > 0 ? `Retry ${failedUploads === 1 ? 'upload' : `${failedUploads} uploads`}` : 'Finish';
  return (
    <Screen keyboard>
      <View style={{ gap: space.xs }}>
        <Text accessibilityRole="header" style={text.title}>Report a bug</Text>
        <Text style={text.body}>{project.data?.name ?? 'Loading project…'}</Text>
        <Text style={text.small}>Describe one reproducible issue so the team can fix it.</Text>
      </View>
      {createdId !== null && queue.images.length > 0 ? <Banner tone="success" message="Your report is saved. Screenshots are attaching to it." /> : null}
      <Banner tone={banner?.tone ?? 'error'} message={banner?.message} />
      <Card>
        {builds.data && builds.data.length > 0 ? <BuildPicker builds={builds.data} value={form.buildId} onChange={pickBuild} disabled={locked} noneLabel="General project issue" /> : null}
        <Field label="Bug title" hint="A short summary, like “Jump gets stuck on stairs”." value={form.title} name="title" onChangeField={update} onBlurField={blur}
          error={shown('title')} maxLength={200} editable={!locked} returnKeyType="next" />
        <ChoiceGroup label="Severity" options={severityOptions} value={form.severity} onChange={pickSeverity} disabled={locked} error={shown('severity')} />
        <Field label="Steps to reproduce" multiline value={form.reproductionSteps} name="reproductionSteps" onChangeField={update} onBlurField={blur}
          error={shown('reproductionSteps')} maxLength={5000} editable={!locked} placeholder={'1. Start a new game\n2. …'} />
        <Field label="What did you expect?" multiline value={form.expectedResult} name="expectedResult" onChangeField={update} onBlurField={blur}
          error={shown('expectedResult')} maxLength={5000} editable={!locked} />
        <Field label="What happened instead?" multiline value={form.actualResult} name="actualResult" onChangeField={update} onBlurField={blur}
          error={shown('actualResult')} maxLength={5000} editable={!locked} />
        <Field label="Device, OS and input method" value={form.environment} name="environment" onChangeField={update} maxLength={500} editable={!locked} />
        <Field label="Extra notes" optional multiline value={form.description} name="description" onChangeField={update} maxLength={5000} editable={!locked} />
        <ScreenshotPicker images={queue.images} onPick={queue.pick} onRemove={queue.remove} error={queue.pickError} disabled={pending || queue.uploading} />
        <Button title={submitLabel} busy={pending || queue.uploading} busyLabel={createdId === null ? 'Submitting…' : 'Uploading…'} disabled={!project.data} onPress={submit} />
        {createdId !== null && failedUploads > 0 ? <Button title="View report without these screenshots" variant="secondary" disabled={pending || queue.uploading} onPress={() => viewReport(createdId)} /> : null}
      </Card>
    </Screen>
  );
}
