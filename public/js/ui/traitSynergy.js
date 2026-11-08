// Direct 特质 combinations in the visible v0.3.1 roster. Match the target's actual eventType: 铃兰's description
// mentions “获得时”, but her own trait is not an 获得时 effect.
import { N_ } from '../../../shared/i18n.js';
import { battleRelation } from '../../synergy/model.js';

export const TRAIT_SYNERGIES = Object.freeze([
  {
    id: 'suzuran-gain', sourceChessId: 'chess_char_5_10_a', sourceGarrisons: ['garrison_60_a', 'garrison_60_b'],
    targetEvent: 'SERVER_GAIN', targetLabel: N_('获得时'),
    summary: N_('铃兰：进入休整期时，再次触发前方干员的「获得时」效果。普通形态前一格，精锐形态前两格。'),
  },
  {
    id: 'ptilopsis-prep-start', sourceChessId: 'chess_char_4_21_a', sourceGarrisons: ['garrison_86_a', 'garrison_86_b'],
    targetEvent: 'SERVER_PREP_START', targetLabel: N_('进入休整期时'),
    summary: N_('白面鸮：复制前方一格干员的「进入休整期时」特质。'),
  },
  {
    id: 'saria-prep-end', sourceChessId: 'chess_char_5_11_a', sourceGarrisons: ['garrison_99_a', 'garrison_99_b'],
    targetEvent: 'SERVER_PREP_FIN', targetLabel: N_('休整期结束时'),
    summary: N_('塞雷娅：复制前方一格干员的「休整期结束时」特质。'),
  },
  {
    id: 'theresa-battle-layers', sourceChessId: 'chess_char_4_25_a', sourceGarrisons: ['garrison_59_a', 'garrison_59_b'],
    targetRole: 'battle-layers', targetLabel: N_('战斗中'),
    summary: N_('魔王：身前一格干员在战斗中因自身特质获得盟约层数时，可使该次层数额外增加。赋予队友叠层特质的干员需要让受赠者站在魔王身前。'),
  },
]);

export const traitSynergy = (id) => TRAIT_SYNERGIES.find((p) => p.id === id) || null;
export const traitSynergyForGarrison = (id) => TRAIT_SYNERGIES.find((p) => p.sourceGarrisons.includes(id)) || null;

/** A visible roster row represents both normal and elite forms; either form can supply the target event. */
export function matchesTraitSynergy(chess, preset, getChess, getGarrison) {
  if (!chess || !preset || chess.chessId === preset.sourceChessId) return false;
  const forms = [chess, chess.goldenId ? getChess(chess.goldenId) : null].filter(Boolean);
  if (preset.targetRole === 'battle-layers') return ['direct', 'granter'].includes(battleRelation(forms, getGarrison)?.role);
  return forms.some((form) => (form.garrisonIds || []).some((id) => getGarrison(id)?.eventType === preset.targetEvent));
}
