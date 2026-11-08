// A third copy of the stage's right-hand normal field for the 5–8 player
// mode. Keep the generated stage untouched: this variant exists only in a
// three-helper 联防 BattleSpec and its renderer.
export const EXTENDED_UNITE_COLS = 29;
export const EXTENDED_UNITE_RECT = Object.freeze({ r0: 9, r1: 12, c0: 0, c1: 28 });

export function extendedUniteStage(stage) {
  if (!stage || stage._extendedUnite) return stage;
  const rows = Array.isArray(stage.rows) ? stage.rows.map((row) => {
    const line = Array.isArray(row) ? row.join('') : String(row ?? '');
    // The second eight-column section is 11..18; 19..20 are its outer wall.
    // Insert another copy before that wall so the entry at 26 connects to the
    // existing path through columns 18..19.
    return line.slice(0, 19) + line.slice(11, 19) + line.slice(19);
  }) : [];
  const devices = Array.isArray(stage.devices) ? [...stage.devices] : [];
  for (const d of stage.devices || []) {
    const row = Number(d.row ?? d.pos?.[0]);
    const col = Number(d.col ?? d.pos?.[1]);
    if (row < 6 || row > 13 || col < 13 || col > 20) continue;
    const copy = { ...d, alias: `${d.raw?.alias ?? d.alias ?? d.key ?? 'device'}:third` };
    if (Array.isArray(d.pos)) copy.pos = [row, col + 8];
    if (Number.isFinite(d.col)) copy.col = col + 8;
    if (Array.isArray(d.rangeTiles)) copy.rangeTiles = d.rangeTiles.map(([r, c]) => [r, c + 8]);
    if (d.raw && typeof d.raw === 'object') copy.raw = { ...d.raw, alias: copy.alias,
      pos: [row, col + 8], rangeTiles: Array.isArray(d.raw.rangeTiles) ? d.raw.rangeTiles.map(([r, c]) => [r, c + 8]) : d.raw.rangeTiles };
    devices.push(copy);
  }
  // Band-granted map characters have a fixed position in each original section (normally col 2 and 10).
  // Give the third helper the same position as the original right-hand section, shifted eight columns.
  const sourceMapChars = stage.mapChars ?? stage.raw?.mapChars ?? [];
  const mapChars = Array.isArray(sourceMapChars) ? [...sourceMapChars] : [];
  for (const m of sourceMapChars) {
    const [row, col] = m.pos || [];
    if (row < 9 || row > 12 || col < 10 || col > 20) continue;
    mapChars.push({ ...m, alias: `${m.alias ?? m.key ?? 'mapChar'}:third`, pos: [row, col + 8] });
  }
  return { ...stage, rows, devices, mapChars,
    ...(stage.raw && typeof stage.raw === 'object' ? { raw: { ...stage.raw, mapChars } } : {}),
    _extendedUnite: true };
}
