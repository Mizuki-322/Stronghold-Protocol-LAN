// A normal and elite card are the same operator for tracking. Keep only base chess ids in the local match set.
export function operatorTrackId(chess) {
  return typeof chess?.baseId === 'string' ? chess.baseId : typeof chess?.chessId === 'string' ? chess.chessId : null;
}

/** Currently visible shop or reward operators that the player tracks (sold cards are excluded). */
export function visibleTrackedOperators(priv, tracked, getChess) {
  const offer = priv?.shop?.rewardOffer;
  const slots = Array.isArray(offer?.slots) && offer.slots.length ? offer.slots : priv?.shop?.slots;
  const found = new Set();
  for (const slot of Array.isArray(slots) ? slots : []) {
    if (!slot || slot.sold || slot.kind === 'item') continue;
    const id = operatorTrackId(getChess(slot.id));
    if (id && tracked?.has(id)) found.add(id);
  }
  return found;
}
