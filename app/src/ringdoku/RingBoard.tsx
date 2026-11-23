import { useId, useRef, useState } from 'react';
import { linkedThirds, ringCellLabel, type RingGroup, type RingGroupKind, type RingLayout } from '../game/ringdoku.js';
import { adjacentRingCell, center, circleBox, ringGeometry } from './geometry';

const groupStyle: Record<RingGroupKind, { title: string; inset: number }> = {
  ring: { title: 'Ring segment', inset: 3.2 },
  spoke: { title: 'Spoke', inset: 5.1 },
  region: { title: 'Curved region', inset: 6.3 },
  bridge: { title: 'Shifted wedge', inset: 9.4 },
};

export function RingLegend({ groups }: { groups: RingGroup[] }) {
  const kinds = new Set(groups.map(group => group.kind));
  return (
    <ul className="ring-legend" aria-label="Region outline key">
      {Object.entries(groupStyle).map(([kind, { title }]) => kinds.has(kind as RingGroupKind) && (
        <li className={`ring-mark-${kind}`} key={kind}><i aria-hidden="true" />{title}</li>
      ))}
    </ul>
  );
}

type CellState = {
  value?: number;
  notes?: number[];
  given?: boolean;
  error?: boolean;
  celebrating?: boolean;
};

type Props = {
  layout: RingLayout;
  cells: CellState[];
  selected: number | null;
  active?: number | null;
  outlines?: boolean;
  onCell: (index: number) => void;
  onArrow?: (index: number) => void;
  outlineCell?: number;
};

export function RingBoard({ layout, cells, selected, active, outlines, onCell, onArrow, outlineCell }: Props) {
  const id = useId();
  const svg = useRef<SVGSVGElement>(null);
  const geometry = ringGeometry(layout);
  const inspected = outlineCell ?? selected;
  const groups = outlines && inspected !== null ? layout.memberships[inspected] : [];
  const cols = Math.ceil(Math.sqrt(layout.symbols.length));
  const rows = Math.ceil(layout.symbols.length / cols);
  const divisions = Array.from({ length: layout.divisions }, (_, index) => index * layout.spokesPerDivision);
  const symbols = layout.symbols.every((n, i) => !i || n === layout.symbols[i - 1] + 1)
    ? `${layout.symbols[0]}–${layout.symbols.at(-1)}`
    : layout.symbols.join(' · ');

  const boardCells = cells.map((state, index) => {
    const ring = Math.floor(index / layout.spokes);
    const spoke = index % layout.spokes;
    const section = Math.floor(spoke / layout.spokesPerDivision);
    const chosen = selected === index;
    const [x, y] = geometry.label(ring, spoke);
    return {
      ...state, index, chosen, x, y,
      path: geometry.cell(index),
      noteSize: Math.min(13, geometry.wedgeWidth(ring) * 0.72 / cols, geometry.depth * 0.82 / rows),
      valueSize: Math.min(25, geometry.wedgeWidth(ring) * 0.75, geometry.depth * 0.72),
      appearance: {
        'data-tone': (ring + Math.floor(spoke / layout.regionSpokes) + section) % 2,
        'data-selected': chosen || undefined,
        'data-matching': (active != null && active === state.value) || undefined,
        'data-given': state.given || undefined,
        'data-error': state.error || undefined,
        'data-celebrating': state.celebrating || undefined,
      },
    };
  });

  return (
    <svg ref={svg} className="ring-board" viewBox={circleBox} role="group" aria-label="Ringdoku board">
      <defs>
        <radialGradient id={id}>
          <stop offset="12%" stopColor="var(--ring-sheen)" stopOpacity=".7" />
          <stop offset="90%" stopColor="var(--ring-sheen)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {boardCells.map(({ value, notes, given, error, index, chosen, path, appearance }) => (
        <g key={index} className="ring-cell" {...appearance}>
          <path
            className="ring-cell-face"
            d={path}
            role="button"
            data-cell={index}
            aria-label={`${ringCellLabel(layout, index)}: ${value || 'empty'}${given ? ', given and locked' : ''}${error ? ', needs review' : ''}${notes?.length ? ', notes ' + notes.join(', ') : ''}`}
            aria-pressed={chosen}
            tabIndex={(selected ?? 0) === index ? 0 : -1}
            onClick={() => onCell(index)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onCell(index);
              } else if (event.key.startsWith('Arrow') && onArrow) {
                event.preventDefault();
                const next = adjacentRingCell(layout, index, event.key);
                onArrow(next);
                svg.current?.querySelector<SVGPathElement>(`[data-cell="${next}"]`)?.focus();
              }
            }}
          />
          <path className="ring-cell-sheen" d={path} fill={`url(#${id})`} aria-hidden="true" />
        </g>
      ))}
      <g className="ring-lines" aria-hidden="true">
        {layout.groups.filter(group => group.kind === 'region').map(group => (
          <path className="ring-region-line" key={group.label} d={geometry.group(group, 0)} />
        ))}
        {divisions.map(spoke => (
          <path className="ring-seam" key={spoke} d={geometry.seam(spoke)} />
        ))}
        {layout.bridgeOffset > 0 && divisions.map(spoke => (
          <path className="ring-bridge-seam" key={spoke} d={geometry.seam(spoke - layout.bridgeOffset)} />
        ))}
        <circle className="ring-rim" cx={center} cy={center} r={layout.outer} />
        <circle className="ring-rim" cx={center} cy={center} r={layout.inner} />
        {groups.map(group => {
          const path = geometry.group(group, groupStyle[group.kind].inset);
          return (
            <g className={`ring-outline ring-mark-${group.kind}`} data-outline={group.kind} key={group.label}>
              <path className="ring-outline-halo" d={path} />
              <path d={path} />
            </g>
          );
        })}
        <text className="ring-symbols" x={center} y={center} textAnchor="middle" dominantBaseline="central">{symbols}</text>
      </g>
      <g aria-hidden="true">
        {boardCells.map(({ value, notes, index, x, y, noteSize, valueSize, appearance }) => (
          <g key={index} className="ring-cell" {...appearance}>
            {value ? (
              <text className="ring-value" x={x} y={y} fontSize={valueSize}>{value}</text>
            ) : notes?.map(note => {
              const slot = layout.symbols.indexOf(note);
              if (slot === -1) return null;
              return (
                <text key={note} className={active === note ? 'ring-note ring-note-match' : 'ring-note'} fontSize={noteSize}
                  x={x + (slot % cols - (cols - 1) / 2) * noteSize * 1.05}
                  y={y + (Math.floor(slot / cols) - (rows - 1) / 2) * noteSize * 1.07}>{note}</text>
              );
            })}
          </g>
        ))}
      </g>
    </svg>
  );
}

const exampleCell = Math.min(linkedThirds.spokes + 1, linkedThirds.memberships.length - 1);
const exampleCells = linkedThirds.memberships.map((_, i) => ({
  value: i === exampleCell ? linkedThirds.symbols[0] : undefined,
  given: i === exampleCell,
}));

export function RingExample() {
  const [cell, setCell] = useState(exampleCell);
  const { symbols, rings, regionRings, regionSpokes, spokesPerDivision, bridgeOffset } = linkedThirds;
  const groups = linkedThirds.memberships[cell];
  return (
    <section className="ring-example" id="ringdoku-help" aria-labelledby="ringdoku-help-title">
      <h2 id="ringdoku-help-title">Ringdoku · linked thirds</h2>
      <p>
        {groups.every(group => group.cells.length === symbols.length)
          ? "Use each number once in each group."
          : "Each group can contain any number at most once."}
        {" "}This board uses {symbols.join(", ")}. Every cell belongs to {groups.length} groups.
      </p>
      <ul>
        <li><strong>Ring segment.</strong> {spokesPerDivision} neighboring cells on one ring, between the solid wedge dividers.</li>
        <li><strong>Spoke.</strong> A straight line of {rings} cells from the center out.</li>
        <li><strong>Curved region.</strong> A block of {regionRings} neighboring rings by {regionSpokes} spokes.</li>
        {bridgeOffset > 0 && <li><strong>Shifted wedge.</strong> {spokesPerDivision} cells on one ring between dashed dividers.
          These fixed wedges are shifted by {bridgeOffset} spokes and connect neighboring sections.</li>}
      </ul>
      <p><strong>Try it.</strong> Select a cell to see its four outlines. In a puzzle, turn on <strong>Show rule outlines</strong> to see the same guides while you play.</p>
      <RingBoard layout={linkedThirds} cells={exampleCells} selected={cell} outlines onCell={setCell} onArrow={setCell} />
      <RingLegend groups={groups} />
      <p className="ring-example-members" aria-live="polite">{ringCellLabel(linkedThirds, cell)} belongs to {groups.map(group => group.label).join(', ')}.</p>
    </section>
  );
}
