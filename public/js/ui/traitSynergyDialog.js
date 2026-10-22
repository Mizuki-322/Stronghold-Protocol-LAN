import { html, Button, Icon, Modal } from './components.js';
import { UnitThumb } from './gameComponents.js';
import { data } from '../data.js';
import { filterRoster, rosterOf } from './loadoutModel.js';
import { traitSynergy } from './traitSynergy.js';
import { battleRelation } from '../../synergy/model.js';
import { t } from '../../../shared/i18n.js';

/** In-match list opened from a source operator's 特质. Banned candidates stay visible with the game's red cross. */
export function TraitSynergyDialog({ synergyId, bannedChess = [], onClose, onPick }) {
  const synergy = traitSynergy(synergyId);
  if (!synergy) return null;
  const source = data.lookup('chess', synergy.sourceChessId);
  const roster = rosterOf(data.list('chess'));
  const list = filterRoster(roster, { synergy: synergy.id }, {}, (id) => data.lookup('chess', id), () => null, null, null,
    (id) => data.lookup('garrisons', id));
  const groups = synergy.targetRole === 'battle-layers'
    ? [
      { role: 'direct', title: t('自身特质可触发魔王加层'), note: t('站在魔王身前一格，满足各自的战斗叠层条件时，魔王可追加层数。') },
      { role: 'granter', title: t('赋予队友叠层特质'), note: t('受赠干员触发叠层；受赠者站在魔王身前时才可能被放大。') },
    ].map((group) => ({ ...group, rows: list.filter((c) => battleRelation([c, c.goldenId ? data.lookup('chess', c.goldenId) : null].filter(Boolean),
      (id) => data.lookup('garrisons', id))?.role === group.role) }))
    : [{ role: 'timing', title: null, note: null, rows: list }];
  const banned = new Set(bannedChess);
  const available = list.filter((c) => !banned.has(c.chessId)).length;
  return html`<${Modal} open=${true} onClose=${onClose} class="trait-synergy-dialog"
      title=${t('{name}可配合干员', { name: source?.name || '' })} micro="ATTRIBUTE SYNERGY"
      actions=${html`<${Button} variant="ghost" onClick=${onClose}>${t('关闭')}<//>`}>
    <p class="trait-synergy-dialog__summary">${t(synergy.summary)}</p>
    <p class="trait-synergy-dialog__count">${t('可用 {available} / 共 {total} 名', { available, total: list.length })}</p>
    ${groups.map((group) => html`<section key=${group.role} class="trait-synergy-dialog__group" aria-label=${group.title || t('可配合干员')}>
      ${group.title ? html`<h3>${group.title} <small class="num">${group.rows.length}</small></h3>` : null}
      ${group.note ? html`<p>${group.note}</p>` : null}
      <div class="trait-synergy-dialog__list" role="group" aria-label=${group.title || t('可配合干员')}>
      ${group.rows.map((c) => {
        const isBanned = banned.has(c.chessId);
        return html`<button key=${c.chessId} type="button" class="trait-synergy-dialog__operator"
          title=${isBanned ? t('本局禁用') : c.name} onClick=${() => onPick(c.chessId)}>
          <span class="trait-synergy-dialog__portrait"><${UnitThumb} kind="chess" id=${c.chessId} size="sm" dim=${isBanned} />
            ${isBanned ? html`<span class="trait-synergy-dialog__ban" aria-label=${t('本局禁用')}><${Icon} name="close" /></span>` : null}</span>
          <span class="trait-synergy-dialog__name">${c.name}</span>
        </button>`;
      })}
      </div>
    </section>`)}
  <//>`;
}
