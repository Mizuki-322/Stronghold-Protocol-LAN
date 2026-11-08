// Local 黍「百谷长青」strategy constants.
export const SHU_BAND = 'band_shu';
export const SHU_HEAL_THRESHOLD = 1;
export const SHU_DEPUTY = 'deputShip';

// These bonds may store layers, but 黍's second healing reward must never target them.
const excludedSecondTargets = new Set(['visiShip', 'miraShip', 'investShip']);

/** Only eligible layer-stacking bonds can be the second healing target. */
export const shuStackable = (bond) => !!bond && !bond.noStack && !excludedSecondTargets.has(bond.bondId);
