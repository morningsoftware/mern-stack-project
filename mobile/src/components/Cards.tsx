import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, text, touch } from '../theme';
import { Button } from './Button';
import { Badge, PlatformBadge, SeverityBadge, StatusBadge } from './Badges';
import { formatDateTime, formatStatus, relativeTime } from '../lib/format';
import { sessionState } from '../lib/models';
import type { Build, Bug, Project, Session } from '../lib/models';

export function Card({ children, onPress, accessibilityLabel }: { children: ReactNode; onPress?: () => void; accessibilityLabel?: string }) {
  if (!onPress) return <View style={styles.card}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.neutralBg }]}>
      {children}
    </Pressable>
  );
}

export function ProjectCard({ project, onPress }: { project: Project; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={`${project.name}, ${formatStatus(project.status)}. Open project`}>
      <View style={styles.titleRow}>
        <Text style={[text.heading, { flex: 1 }]} numberOfLines={2}>{project.name}</Text>
        <Text accessibilityElementsHidden style={styles.chevron}>›</Text>
      </View>
      <Text style={text.body} numberOfLines={3}>{project.description || 'No project description yet.'}</Text>
      <StatusBadge status={project.status} />
    </Card>
  );
}

export function BuildCard({ build, onOpen, onFeedback, onReport, opening = false }: {
  build: Build; onOpen: () => void; onFeedback: () => void; onReport: () => void; opening?: boolean;
}) {
  return (
    <Card>
      <View style={styles.titleRow}>
        <Text style={[text.heading, { flex: 1 }]} numberOfLines={1}>Build {build.version}</Text>
        <PlatformBadge platform={build.platform} />
      </View>
      <Text style={text.body} numberOfLines={5}>{build.releaseNotes || 'No release notes.'}</Text>
      {build.platform === 'web' ? <Text style={text.small}>Plays in your browser.</Text> : <Text style={text.small}>Opens the published download link in your browser.</Text>}
      <Button title={`Open build ${build.version}`} variant="secondary" onPress={onOpen} busy={opening} />
      <View style={styles.actions}>
        <Button title="Give feedback" onPress={onFeedback} style={styles.action} />
        <Button title="Report a bug" variant="secondary" onPress={onReport} style={styles.action} />
      </View>
    </Card>
  );
}

const sessionLabels = { open: 'Open', closed: 'Closed', passed: 'Deadline passed' } as const;

export function SessionCard({ session, buildLabel, now, onFeedback }: { session: Session; buildLabel?: string; now: number; onFeedback: () => void }) {
  const state = sessionState(session, now);
  return (
    <Card>
      <View style={styles.titleRow}>
        <Text style={[text.heading, { flex: 1 }]} numberOfLines={2}>{session.title}</Text>
        <Badge label={sessionLabels[state]} tone={state === 'open' ? 'success' : 'neutral'} />
      </View>
      <Text style={text.body}>{session.instructions}</Text>
      <Text style={text.small}>{buildLabel ? `${buildLabel} · ` : ''}{state === 'open' ? 'Due' : 'Was due'} {formatDateTime(session.deadline)}</Text>
      <Button title="Give session feedback" onPress={onFeedback} disabled={state !== 'open'} />
    </Card>
  );
}

export function ReportCard({ bug, projectName, buildLabel, onPress, now }: { bug: Bug; projectName?: string; buildLabel?: string; onPress: () => void; now?: number }) {
  const meta = [projectName, buildLabel, bug.createdOn ? relativeTime(bug.createdOn, now) : ''].filter(Boolean).join(' · ');
  return (
    <Card onPress={onPress} accessibilityLabel={`${bug.title}. ${formatStatus(bug.status)}, ${formatStatus(bug.severity)} severity. View report`}>
      <View style={styles.titleRow}>
        <Text style={[text.subheading, { flex: 1 }]} numberOfLines={2}>{bug.title}</Text>
        <Text accessibilityElementsHidden style={styles.chevron}>›</Text>
      </View>
      <View style={styles.badges}>
        <StatusBadge status={bug.status} />
        <SeverityBadge severity={bug.severity} />
        {bug.screenshotCount ? <Badge label={`${bug.screenshotCount} ${bug.screenshotCount === 1 ? 'screenshot' : 'screenshots'}`} /> : null}
      </View>
      {meta ? <Text style={text.small} numberOfLines={2}>{meta}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius, backgroundColor: colors.surface },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  chevron: { fontSize: 26, lineHeight: 28, color: colors.muted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1, minHeight: touch },
});
