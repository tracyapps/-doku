import data from "./catalog.json";
import {findConflicts} from './conflicts.mjs';
export type Group = { name: string; cells: number[] };
export type Model = {
  id: string;
  title: string;
  size: number;
  cells: { ring: number; sector: number }[];
  groups: Group[];
  geometry: {
    rings: number;
    sectors: number;
    inner: number;
    outer: number;
    split: number;
    linked: boolean;
    wide: boolean;
    boxH: number;
    boxW: number;
  };
  noteFontSVG: number;
};
export const catalog = data as unknown as {
  round: string;
  models: Model[];
  samples: {
    id: string;
    model: string;
    profile: string;
    seed: number;
    givens: number[];
    unique: number;
    independent: number;
  }[];
};
export type Snapshot = { values: number[]; notes: number[][] };
export type TestGame = Snapshot & {
  sample: string;
  selected: number | null;
  active: number | null;
  pencil: boolean;
  inspector: boolean;
  inspectCell: number | null;
  past: Snapshot[];
};
export const createGame = (
  sample: (typeof catalog.samples)[number],
): TestGame => ({
  sample: sample.id,
  values: [...sample.givens],
  notes: sample.givens.map(() => []),
  selected: null,
  active: null,
  pencil: false,
  inspector: false,
  inspectCell: null,
  past: [],
});
export function groupsAt(model: Model, cell: number) {
  return model.groups.filter((g) => g.cells.includes(cell));
}
export function badCells(model: Model, values: number[]) {
  return new Set(
    findConflicts(model.groups, values).flatMap(c=>c.cells),
  );
}
export function possible(model: Model, values: number[], cell: number) {
  if (values[cell]) return [];
  const used = new Set(
    groupsAt(model, cell).flatMap((g) => g.cells.map((i) => values[i])),
  );
  return Array.from({ length: model.size }, (_, i) => i + 1).filter(
    (n) => !used.has(n),
  );
}
export function visitCell(
  state: TestGame,
  model: Model,
  givens: number[],
  cell: number,
): TestGame {
  if (!Number.isInteger(cell) || cell < 0 || cell >= state.values.length)
    return state;
  if (state.inspector) return { ...state, inspectCell: cell };
  if (!state.active || givens[cell]) return { ...state, selected: cell };
  return putValue({ ...state, selected: cell }, model, givens, state.active);
}
export function putValue(
  state: TestGame,
  model: Model,
  givens: number[],
  value: number,
): TestGame {
  const cell = state.selected;
  if (
    state.inspector ||
    cell === null ||
    givens[cell] ||
    value < 0 ||
    value > model.size
  )
    return state;
  const next = {
    ...state,
    values: [...state.values],
    notes: state.notes.map((n) => [...n]),
    past: [
      ...state.past.slice(-199),
      { values: [...state.values], notes: state.notes.map((n) => [...n]) },
    ],
  };
  if (state.pencil && value) {
    if (state.values[cell]) return state;
    next.notes[cell] = state.notes[cell].includes(value)
      ? state.notes[cell].filter((n) => n !== value)
      : [...state.notes[cell], value].sort((a, b) => a - b);
  } else {
    next.values[cell] = value;
    next.notes[cell] = [];
  }
  return next;
}
export function restoreGame(state: TestGame): TestGame {
  if (state.inspector || !state.past.length) return state;
  const old = state.past[state.past.length - 1];
  return {
    ...state,
    values: [...old.values],
    notes: old.notes.map((n) => [...n]),
    past: state.past.slice(0, -1),
  };
}
export function inspectedGroups(state: TestGame, model: Model) {
  return state.inspector && state.inspectCell !== null
    ? groupsAt(model, state.inspectCell)
    : [];
}
