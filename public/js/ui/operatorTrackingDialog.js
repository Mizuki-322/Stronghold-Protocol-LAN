import { useState } from '../../vendor/hooks.module.js';
import { html, Button, Modal } from './components.js';
import { UnitThumb } from './gameComponents.js';
import { rosterOf } from './loadoutModel.js';
import { data } from '../data.js';
import { t } from '../../../shared/i18n.js';

/** Choose any visible operator before it appears in the shop. Selections last for this match only. */
export function OperatorTrackingDialog({ tracked, bannedChess = [], onToggle, onClose }) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase();
  const banned = new Set(bannedChess);
  const roster = rosterOf(data.list('chess'));
  const matches = roster.filter((c) => !needle || [c.name, c.appellation, c.subProfessionName]
    .some((part) => String(part || '').toLocaleLowerCase().includes(needle)));
  return html`<${Modal} open=${true} onClose=${onClose} class="operator-tracking-dialog"
      title=${t('选择追踪干员')} micro="OPERATOR TRACKING"
      actions=${html`<${Button} variant="ghost" onClick=${onClose}>${t('关闭')}<//>`}>
    <p class="operator-tracking-dialog__count">${t('已追踪 {n} 名干员', { n: tracked?.size || 0 })}</p>
    <input type="search" class="operator-tracking-dialog__search" value=${query}
      placeholder=${t('搜索干员姓名或职业')} aria-label=${t('搜索干员姓名或职业')}
      onInput=${(event) => setQuery(event.currentTarget.value)} />
    <div class="operator-tracking-dialog__list" role="group" aria-label=${t('选择追踪干员')}>
      ${matches.map((c) => {
        const chosen = !!tracked?.has(c.chessId);
        const isBanned = banned.has(c.chessId);
        return html`<button key=${c.chessId} type="button" class=${`operator-tracking-dialog__operator${chosen ? ' is-tracked' : ''}`}
          aria-pressed=${String(chosen)} title=${isBanned ? t('本局禁用') : c.name} onClick=${() => onToggle(c.chessId)}>
          <${UnitThumb} kind="chess" id=${c.chessId} size="sm" dim=${isBanned} />
          <span>${c.name}</span>
        </button>`;
      })}
    </div>
  <//>`;
}
