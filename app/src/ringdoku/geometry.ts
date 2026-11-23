import type { RingLayout, RingGroup } from '../game/ringdoku.js';

export const center = 210;
export const circleBox = '0 0 420 420';
const tau = Math.PI * 2;
const point = (radius: number, angle: number) =>
  [center + radius * Math.cos(angle), center + radius * Math.sin(angle)];

function arcTo(radius: number, from: number, to: number) {
  const span = to - from;
  const steps = Math.max(1, Math.ceil(Math.abs(span) / Math.PI));
  return Array.from({ length: steps }, (_, i) =>
    `A${radius},${radius} 0 0 ${span > 0 ? 1 : 0} ${point(radius, from + span * (i + 1) / steps)}`,
  ).join('');
}

export function ringGeometry(layout: RingLayout) {
  const depth = (layout.outer - layout.inner) / layout.rings;
  const angle = tau / layout.spokes;
  const radius = (ring: number) => layout.inner + ring * depth;
  const bearing = (spoke: number) => -Math.PI / 2 + spoke * angle;
  const segment = (ring: number, ringCount: number, spoke: number, spokeCount: number, inset = 0) => {
    const radialCenter = radius(ring + ringCount / 2);
    const padding = Math.min(inset, depth * ringCount * 0.28, radialCenter * angle * spokeCount * 0.33);
    const inner = radius(ring) + padding;
    const outer = radius(ring + ringCount) - padding;
    const track = padding / radialCenter;
    const start = bearing(spoke) + track;
    const end = bearing(spoke + spokeCount) - track;
    return `M${point(inner, start)}L${point(outer, start)}${arcTo(outer, start, end)}L${point(inner, end)}${arcTo(inner, end, start)}Z`;
  };
  return {
    depth,
    wedgeWidth: (ring: number) => 2 * radius(ring + 0.5) * Math.sin(Math.min(angle, Math.PI) / 2),
    cell: (index: number) => segment(Math.floor(index / layout.spokes), 1, index % layout.spokes, 1),
    label: (ring: number, spoke: number) => point(radius(ring + 0.5), bearing(spoke + 0.5)),
    group: (group: RingGroup, inset: number) =>
      segment(group.firstRing, group.ringCount, group.firstSpoke, group.spokeCount, inset),
    seam: (spoke: number) =>
      `M${point(layout.inner, bearing(spoke))}L${point(layout.outer, bearing(spoke))}`,
  };
}

export function adjacentRingCell(layout: RingLayout, cell: number, key: string) {
  const spoke = cell % layout.spokes;
  switch (key) {
    case 'ArrowLeft': return cell - spoke + (spoke + layout.spokes - 1) % layout.spokes;
    case 'ArrowRight': return cell - spoke + (spoke + 1) % layout.spokes;
    case 'ArrowUp': return Math.max(spoke, cell - layout.spokes);
    case 'ArrowDown': return Math.min((layout.rings - 1) * layout.spokes + spoke, cell + layout.spokes);
    default: return cell;
  }
}
