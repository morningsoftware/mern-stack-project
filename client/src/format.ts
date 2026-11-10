import type { BuildPlatform } from "./constants";

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
