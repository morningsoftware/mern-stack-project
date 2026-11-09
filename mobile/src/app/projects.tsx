import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Field, Heading, Notice, Screen, styles } from '../components/ui';
import { useSession } from '../lib/session';
import { useResource } from '../lib/useResource';
import type { Project } from '../lib/models';
export default function Projects() {
  const session = useSession();
  const projects = useResource<Project[]>('/api/projects');
  const [search, setSearch] = useState('');
  const rows = projects.data?.filter(p => `${p.name} ${p.description || ''}`.toLowerCase().includes(search.toLowerCase()));
  return <Screen title="Choose a playtest project" refresh={projects.reload} refreshing={projects.loading}>
    <Text style={styles.muted}>Signed in as {session.user?.displayName}. Projects follow the shared API’s authenticated discovery rules.</Text>
    <Field label="Search projects" value={search} onChangeText={setSearch} />
    <Notice text={projects.error} error />
    {projects.loading && <Text style={styles.text}>Loading projects…</Text>}
    {rows?.map(p => <Card key={p._id}><Heading>{p.name}</Heading><Text style={styles.text}>{p.description || 'No project description yet.'}</Text><Text style={styles.muted}>Status: {p.status}</Text><Button title={`Open ${p.name}`} onPress={() => router.push({ pathname: '/project/[id]', params: { id: p._id } })} /></Card>)}
    {rows?.length === 0 && <Text style={styles.text}>No projects match. Ask a teammate to create or publish the project in the desktop workspace.</Text>}
    <Button title="Refresh projects" secondary onPress={projects.reload} busy={projects.loading} />
    <Button title="Sign out" secondary onPress={() => { void session.signOut(); }} />
  </Screen>;
}
