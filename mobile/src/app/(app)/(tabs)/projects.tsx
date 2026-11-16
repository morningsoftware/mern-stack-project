import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { Banner, EmptyState, ErrorState, Field, ProjectCard, Screen, SkeletonList } from '../../../components';
import { useRefreshOnFocus } from '../../../lib/hooks';
import { browseProjects } from '../../../lib/models';
import type { Project } from '../../../lib/models';
import { useSession } from '../../../lib/session';
import { useResource } from '../../../lib/useResource';
import { text } from '../../../theme';

export default function Projects() {
  const { user } = useSession();
  const projects = useResource<Project[]>('/api/projects');
  const [search, setSearch] = useState('');
  useRefreshOnFocus(projects.reload);
  const rows = useMemo(() => browseProjects(projects.data ?? [], search), [projects.data, search]);

  return (
    <Screen bottomInset={false} onRefresh={projects.reload} refreshing={projects.refreshing}>
      <Text style={text.body}>Hi {user?.displayName}. Pick a game to find its builds and playtest sessions.</Text>
      <Field label="Search projects" value={search} onChangeText={setSearch} placeholder="Name or description" returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing" />
      {projects.loading && !projects.data ? <SkeletonList label="Loading projects" /> : null}
      {projects.error && !projects.data ? <ErrorState message={projects.error} onRetry={projects.reload} title="Could not load projects" /> : null}
      {projects.error && projects.data ? <Banner tone="error" message={`Could not refresh. ${projects.error}`} actionLabel="Try again" onAction={projects.reload} /> : null}
      {projects.data && rows.length === 0 ? (
        search.trim()
          ? <EmptyState title="No matching projects" body={`Nothing matches “${search.trim()}”. Check the spelling or search by part of the name.`} actionLabel="Clear search" onAction={() => setSearch('')} />
          : <EmptyState title="No projects yet" body="Ask a teammate to create or share a project in the desktop workspace, then pull down to refresh." actionLabel="Refresh" onAction={projects.reload} />
      ) : null}
      {rows.map(project => <ProjectCard key={project._id} project={project} onPress={() => router.push({ pathname: '/project/[id]', params: { id: project._id } })} />)}
    </Screen>
  );
}
