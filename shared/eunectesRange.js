// 森蚺策略“双眼皮”的射程。原装置 3×5，靠炮台的三排再向两侧各扩一格。
// Both the battle sim and the inspected device card use this geometry.
export function eunectesRangeTiles(row, col, authored = [], { inBounds = (_r, _c) => true, inField = (_r, _c) => true } = {}) {
  const dr = authored.reduce((sum, [r]) => sum + r - row, 0);
  const dc = authored.reduce((sum, [, c]) => sum + c - col, 0);
  const alongRow = Math.abs(dr) >= Math.abs(dc);
  const step = (alongRow ? dr : dc) < 0 ? -1 : 1;
  const shape = (sign) => {
    const tiles = [];
    for (let depth = 0; depth < 5; depth++) {
      const width = depth < 3 ? 2 : 1;
      for (let side = -width; side <= width; side++) {
        const r = row + (alongRow ? sign * depth : side);
        const c = col + (alongRow ? side : sign * depth);
        if (inBounds(r, c)) tiles.push([r, c]);
      }
    }
    return tiles;
  };
  const forward = shape(step);
  const backward = shape(-step);
  const coverage = (tiles) => tiles.filter(([r, c]) => inField(r, c)).length;
  return coverage(backward) > coverage(forward) ? backward : forward;
}
