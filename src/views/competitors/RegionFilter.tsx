// `REGION │ any ▾` (D-145): only the competitors operating there; other cards stay. In the filter bar it shows once a
// competitor has a region; the matrix, where it matters most, always shows it (`always`).
import { useWsView } from "../../state/workspaceView";
import { Menu } from "../../ui/Menu";
import { useWs } from "../workspace/context";
import { useRegionChoices } from "./regions";

export function RegionFilter({
  up,
  always,
}: {
  up?: boolean;
  always?: boolean;
}) {
  const { competitors } = useWs();
  const { regions, toggleRegion, clearRegions } = useWsView();
  const choices = useRegionChoices(competitors);
  if (!choices.length && !regions.length && !always) return null;
  // A region chosen earlier but no longer in use still shows, so it can be turned off.
  const gone = regions
    .filter((r) => !choices.some((c) => c.region === r))
    .map((region) => ({ region, count: 0, inside: false }));
  return (
    <Menu
      up={up}
      label="region"
      summary={
        regions.length === 0
          ? "any"
          : regions.length === 1
            ? regions[0]
            : `${regions.length}`
      }
      active={regions.length > 0}
      ariaLabel="Only competitors operating in these regions"
      empty="No regions yet: add where a competitor operates in its panel"
      search={choices.length > 8 ? "find a region" : undefined}
      items={
        choices.length || regions.length
          ? [
              {
                key: "any",
                label: "anywhere",
                checked: regions.length === 0,
                onSelect: clearRegions,
              },
              ...[...choices, ...gone].map(({ region, count, inside }) => ({
                key: region,
                // Countries sit under their continent.
                label: inside ? `\u00a0\u00a0${region}` : region,
                hint: `${count}`,
                checked: regions.includes(region),
                tone: "var(--accent-yellow)",
                onSelect: () => toggleRegion(region),
              })),
            ]
          : []
      }
    />
  );
}
