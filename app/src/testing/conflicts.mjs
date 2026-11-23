// Current-entry conflicts only: notes and unfilled cells never count as duplicates.
export function findConflicts(groups, values) {
  return groups.flatMap((group) => {
    const positions = new Map();
    for (const cell of group.cells) {
      const value = values[cell];
      if (!value) continue;
      if (!positions.has(value)) positions.set(value, []);
      positions.get(value).push(cell);
    }
    return [...positions].flatMap(([value, cells]) =>
      cells.length > 1 ? [{ group, value, cells }] : [],
    );
  });
}

export function describeConflict(conflict, cellName) {
  const group = conflict.group.name.replace(/^./, (c) => c.toUpperCase());
  const frequency = conflict.cells.length === 2 ? 'twice' : `${conflict.cells.length} times`;
  return `${conflict.value} appears ${frequency} in ${group}: ${conflict.cells.map(cellName).join('; ')}.`;
}
