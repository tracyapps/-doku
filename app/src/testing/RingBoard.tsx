import type { Model, TestGame, Group } from "./rules";
import { badCells, inspectedGroups } from "./rules";
const colors = ["#b5a0ff", "#9ce6ff", "#9bf0c4", "#ffce8f", "#ffabd6"];
const polar = (r: number, a: number) => [
  210 + r * Math.cos(a),
  210 + r * Math.sin(a),
];
function sector(r0: number, r1: number, a: number, b: number) {
  return `M${polar(r0, a)}L${polar(r1, a)}A${r1},${r1} 0 0 1 ${polar(r1, b)}L${polar(r0, b)}A${r0},${r0} 0 0 0 ${polar(r0, a)}Z`;
}
function boundary(model: Model, group: Group, inset: number) {
  const g = model.geometry,
    dr = (g.outer - g.inner) / g.rings,
    da = (2 * Math.PI) / g.sectors,
    set = new Set(group.cells);
  let path = "";
  for (const i of group.cells) {
    const { ring: r, sector: c } = model.cells[i],
      r0 = g.inner + r * dr + inset,
      r1 = g.inner + (r + 1) * dr - inset,
      a = -Math.PI / 2 + c * da + inset / 120,
      b = -Math.PI / 2 + (c + 1) * da - inset / 120;
    if (r === 0 || !set.has(i - g.sectors))
      path += `M${polar(r0, a)}A${r0},${r0} 0 0 1 ${polar(r0, b)}`;
    if (r === g.rings - 1 || !set.has(i + g.sectors))
      path += `M${polar(r1, a)}A${r1},${r1} 0 0 1 ${polar(r1, b)}`;
    if (!set.has(r * g.sectors + ((c + g.sectors - 1) % g.sectors)))
      path += `M${polar(r0, a)}L${polar(r1, a)}`;
    if (!set.has(r * g.sectors + ((c + 1) % g.sectors)))
      path += `M${polar(r0, b)}L${polar(r1, b)}`;
  }
  return path;
}
export function RingBoard({
  model,
  state,
  givens,
  onCell,
}: {
  model: Model;
  state: TestGame;
  givens: number[];
  onCell: (i: number) => void;
}) {
  const geo = model.geometry,
    step = (geo.outer - geo.inner) / geo.rings,
    angle = (Math.PI * 2) / geo.sectors,
    bad = badCells(model, state.values),
    groups = inspectedGroups(state, model),
    members = new Set(groups.flatMap((g) => g.cells));
  const cols = model.size === 4 ? 2 : 4;
  return (
    <>
      <svg
        className="test-board"
        viewBox="0 0 420 420"
        role="group"
        aria-label={model.title + " board"}
      >
        {model.cells.map(({ ring: r, sector: c }, i) => {
          const r0 = geo.inner + r * step,
            r1 = r0 + step,
            a = -Math.PI / 2 + c * angle,
            b = a + angle,
            [x, y] = polar((r0 + r1) / 2, (a + b) / 2),
            v = state.values[i],
            matched =
              !state.inspector &&
              state.active &&
              (v === state.active || state.notes[i].includes(state.active)),
            selected = state.inspector
              ? state.inspectCell === i
              : state.selected === i,
            font = Math.min(25, step * 0.9);
          return (
            <g key={i}>
              <path
                data-cell={i}
                role="button"
                tabIndex={0}
                aria-label={`${state.inspector ? "Inspect" : "Select"} ring ${r + 1}, spoke ${c + 1}: ${v ? v : "empty"}${givens[i] ? ", given" : ""}${!v && state.notes[i].length ? ", notes " + state.notes[i].join(", ") : ""}${bad.has(i)?', conflict: this value repeats in a shared group':''}`}
                aria-pressed={selected}
                d={sector(r0, r1, a, b)}
                fill={
                  bad.has(i)?'#502936':selected
                    ? "var(--test-selected)"
                    : matched
                      ? "var(--test-match)"
                      : state.inspector && members.has(i)
                        ? "#243e4b"
                        : "var(--test-cell)"
                }
                stroke={
                  bad.has(i) ? "#ff9baa" : selected ? "#9bf0c4" : "#5f738b"
                }
                strokeWidth={bad.has(i)?3.2:selected ? 2.6 : 0.65}
                onClick={() => onCell(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onCell(i);
                  }
                }}
              />
              {v ? (
                <text
                  x={x}
                  y={y + font * 0.32}
                  textAnchor="middle"
                  fontSize={font}
                  fill={bad.has(i)?'#ffd5dc':givens[i] ? "#d1dced" : "#9bf0c4"}
                  fontWeight={bad.has(i)?800:givens[i] ? 500 : 750}
                  textDecoration={bad.has(i)?'underline':undefined}
                >
                  {v}
                </text>
              ) : (
                state.notes[i].map((n) => (
                  <text
                    key={n}
                    x={
                      x +
                      (((n - 1) % cols) - (cols - 1) / 2) *
                        model.noteFontSVG *
                        1.15
                    }
                    y={
                      y +
                      (Math.floor((n - 1) / cols) - 0.5) *
                        model.noteFontSVG *
                        1.3 +
                      model.noteFontSVG * 0.32
                    }
                    textAnchor="middle"
                    fontSize={model.noteFontSVG}
                    fill={
                      !state.inspector && state.active === n
                        ? "#9bf0c4"
                        : "#e9eff7"
                    }
                  >
                    {n}
                  </text>
                ))
              )}
            </g>
          );
        })}
        {Array.from({ length: geo.rings + 1 }, (_, r) => {
          const region = !geo.wide && r === 2;
          return r === 0 || r === geo.rings || region ? (
            <circle
              key={r}
              cx="210"
              cy="210"
              r={geo.inner + r * step}
              fill="none"
              stroke={region ? "#b5a0ff" : "#a9bad0"}
              strokeWidth={region ? 2.8 : 1.2}
              pointerEvents="none"
            />
          ) : null;
        })}
        {Array.from({ length: geo.sectors }, (_, c) => {
          let color: string | null = null,
            width = 2.8,
            dash: string | undefined;
          if (geo.linked) {
            if (c % 4 === 0) color = "#b5a0ff";
            else if (c % 4 === 2) {
              color = "#ffce8f";
              dash = "6 3";
            }
          } else if (geo.wide && c % 2 === 0) color = "#bacce2";
          else if (model.id === "ring4" && c % 2 === 0) color = "#b5a0ff";
          if (!color) return null;
          const a = -Math.PI / 2 + c * angle;
          return (
            <path
              key={c}
              d={`M${polar(geo.inner, a)}L${polar(geo.outer, a)}`}
              stroke={color}
              strokeWidth={width}
              strokeDasharray={dash}
              pointerEvents="none"
            />
          );
        })}
        {groups.map((group, i) => (
          <path
            key={group.name}
            d={boundary(model, group, 1.8 + i * 0.8)}
            fill="none"
            stroke={colors[i % colors.length]}
            strokeWidth="2.1"
            strokeDasharray={i % 2 ? "5 2" : undefined}
            pointerEvents="none"
          />
        ))}
        <text x="210" y="215" textAnchor="middle" fill="#9bf0c4" fontSize="14">
          1–{model.size}
        </text>
      </svg>
      {state.inspector && groups.length > 0 && (
        <ul className="inspector-legend">
          {groups.map((g, i) => (
            <li key={g.name}>
              <i style={{ background: colors[i % colors.length] }} />
              {g.name}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
