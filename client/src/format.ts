import type { BuildPlatform } from "./constants";
import type { User } from "./types";

export const BUILD_PLATFORM_LABELS: Record<BuildPlatform, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  web: "Web",
  other: "Other",
};

export function formatStatus(value: string): string {
  return value.replaceAll("_", " ");
}

export function countLabel(
  count: number,
  singular: string,
  plural = `${singular}s`
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function userAvatarUrl(
  user: Pick<User, "_id" | "avatarUpdatedOn">
): string | null {
  return user.avatarUpdatedOn
    ? `/api/users/${user._id}/avatar?v=${encodeURIComponent(user.avatarUpdatedOn)}`
    : null;
}
