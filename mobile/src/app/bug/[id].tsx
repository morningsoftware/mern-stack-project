import { useRef, useState } from 'react';
import { Image, Platform, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Button, Card, Heading, Notice, Screen, styles } from '../../components/ui';
import { api, useSession } from '../../lib/session';
import { useResource } from '../../lib/useResource';
import type { Bug, Screenshot } from '../../lib/models';
export default function BugPage() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const { user } = useSession();
  const bug = useResource<Bug>(id ? `/api/bug-reports/${encodeURIComponent(id)}` : null);
  const mine = bug.data?.reportedBy === user?._id;
  const screenshots = useResource<Screenshot[]>(mine ? `/api/bug-reports/${encodeURIComponent(id)}/screenshots` : null);
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  async function chooseImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .8, allowsEditing: false });
      if (result.canceled) return;
      const picked = result.assets[0];
      if (picked.fileSize && picked.fileSize > 2 * 1024 * 1024) throw new Error('Choose a screenshot smaller than 2 MB.');
      if (picked.mimeType && !['image/png', 'image/jpeg', 'image/webp'].includes(picked.mimeType)) throw new Error('Choose PNG, JPEG or WebP. HEIC screenshots must be exported to JPEG first.');
      setAsset(picked); setError(''); setNotice('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not open your photos.'); }
  }
  async function upload() {
    if (!asset || lock.current) return;
    lock.current = true; setPending(true); setError(''); setNotice('');
    try {
      const body = Platform.OS === 'web' ? await fetch(asset.uri).then(r => r.blob()) : new File(asset.uri);
      if (body.size > 2 * 1024 * 1024) throw new Error('Choose a screenshot smaller than 2 MB.');
      const type = asset.mimeType || body.type || 'image/jpeg';
      await api.request(`/api/bug-reports/${encodeURIComponent(id)}/screenshots`, { method: 'POST', headers: { 'Content-Type': type }, body });
      setAsset(null); setNotice('Screenshot attached.'); screenshots.reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not upload the screenshot. Your report is already saved.'); }
    finally { lock.current = false; setPending(false); }
  }
  async function remove(screenshotId: string) {
    if (lock.current) return;
    lock.current = true; setPending(true); setError(''); setNotice('');
    try { await api.request(`/api/bug-reports/${encodeURIComponent(id)}/screenshots/${encodeURIComponent(screenshotId)}`, { method: 'DELETE' }); setNotice('Screenshot removed.'); screenshots.reload(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not remove the screenshot.'); }
    finally { lock.current = false; setPending(false); }
  }
  return <Screen title="Bug report" refresh={() => { bug.reload(); screenshots.reload(); }} refreshing={bug.loading}>
    <Notice text={bug.error || error || screenshots.error} error />
    {bug.loading && <Text style={styles.text}>Loading report…</Text>}
    {bug.data && !mine && <Notice text="This screen shows reports submitted by your account. Open My bug reports to choose your own report." error />}
    {bug.data && mine && <>
      {created === 'yes' && <Notice text="Bug report saved. Screenshot attachment is optional." />}
      <Card><Heading>{bug.data.title}</Heading><Text style={styles.text}>Status: {bug.data.status} · Severity: {bug.data.severity}</Text>
        <Text style={styles.muted}>Report {bug.data._id}</Text>
        {(['reproductionSteps', 'expectedResult', 'actualResult', 'environment', 'description'] as const).map((key, index) => bug.data?.[key] ? <Text key={key} selectable style={styles.text}>{['Steps to reproduce', 'Expected', 'Actual', 'Environment', 'Notes'][index]}: {bug.data[key]}</Text> : null)}
      </Card>
      <Heading>Screenshots ({screenshots.data?.length || 0}/3)</Heading>
      <Text style={styles.muted}>PNG, JPEG or WebP · up to 2 MB each. Photos stay private to the reporter and project team.</Text>
      <Notice text={notice} />
      {screenshots.data?.map((shot, index) => <Card key={shot._id}><Text style={styles.text}>Attachment {index + 1}: {shot.contentType} · {Math.ceil(shot.size / 1024)} KB</Text><Button title={`Remove attachment ${index + 1}`} secondary disabled={pending} onPress={() => { void remove(shot._id); }} /></Card>)}
      <Button title="Choose screenshot" secondary disabled={pending || screenshots.loading || !screenshots.data || screenshots.data.length >= 3} onPress={() => { void chooseImage(); }} />
      {asset && <Card><Image source={{ uri: asset.uri }} accessibilityLabel="Selected screenshot preview" style={{ width: '100%', height: 220 }} resizeMode="contain" /><Button title="Attach screenshot" busy={pending} onPress={() => { void upload(); }} /><Button title="Discard selected screenshot" secondary disabled={pending} onPress={() => setAsset(null)} /></Card>}
      <Button title="My bug reports" secondary disabled={pending} onPress={() => router.replace({ pathname: '/my-bugs', params: { projectId: bug.data!.projectId } })} />
      <Button title="Back to project" disabled={pending} onPress={() => router.replace({ pathname: '/project/[id]', params: { id: bug.data!.projectId } })} />
    </>}
  </Screen>;
}
