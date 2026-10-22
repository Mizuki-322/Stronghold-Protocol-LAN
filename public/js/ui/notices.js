// 公告 (DESIGN §34.14). The title screen always shows the project's own attribution notice. Plugin notices are
// shown alongside it when present, and in the lobby only when the server's catalogue has notices. Opening the
// popup marks plugin notices as seen (sp.pref.notices-seen); plugin bodies remain plain text, never HTML.

import { useEffect, useState } from '../../vendor/hooks.module.js';
import { html, Modal, Button } from './components.js';
import { useStore } from '../store.js';
import { catalog, loadCatalog, installedCount, pluginName } from '../content.js';
import { useLang } from './lang.js';
import { t } from '../../../shared/i18n.js';
import { noticeView, readSeen, markSeen } from '../../../shared/plugins/notices.js';

/** Title and lobby entry. The project notice belongs only on the title screen. */
export function NoticesButton({ project = false }) {
  const installed = useStore((s) => installedCount(s) > 0 || s.installedNotices === true);
  const cat = useStore((s) => s, Object.is, catalog);
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => readSeen());
  useEffect(() => { if (installed) loadCatalog(); }, [installed]);
  const view = installed ? noticeView(cat.plugins, lang, seen, pluginName) : { notices: [], unread: false };
  if (!project && !view.notices.length) return null;
  const openPopup = () => {
    if (view.notices.length) setSeen(markSeen(view.notices.map((n) => n.key)));
    setOpen(true);
  };
  return html`<span class="notice-slot">
    <button type="button" class="notice-entry tapx" data-testid="notices-open" aria-label=${t('公告')} onClick=${openPopup}>
      ${t('公告')}
      ${view.unread ? html`<span class="notice-entry__dot" aria-label=${t('有未读公告')}></span>` : null}
    </button>
    <${Modal} open=${open} title=${t('公告')} micro="NOTICES" onClose=${() => setOpen(false)}
      actions=${html`<${Button} variant="primary" onClick=${() => setOpen(false)}>${t('关闭')}<//>`}>
      <div class="notice-list">
        ${project ? html`<article class="notice-card" data-notice="project-license">
          <p class="notice-card__meta">${t('项目说明')}</p>
          <h3 class="notice-card__title">${t('开源与版权公告')}</h3>
          <p class="notice-card__body">${t('本版本基于 sganggs/Stronghold-Protocol 项目的源代码修改。原项目与本版本自行编写的代码遵循 GPL-3.0-or-later。')}</p>
          <p class="notice-card__body">${t('《明日方舟》的角色、美术、音乐、文本和游戏数据归原权利人所有，不属于 GPL 授权范围。本项目是非官方、非商业同人作品，与鹰角网络或 Yostar 无关。')}</p>
          <nav class="notice-card__links" aria-label=${t('许可与源码')}>
            <a href="https://github.com/sganggs/Stronghold-Protocol" target="_blank" rel="noopener noreferrer">${t('原项目源码')}</a>
            <a href="https://github.com/sganggs/Stronghold-Protocol/blob/master/LICENSE" target="_blank" rel="noopener noreferrer">LICENSE</a>
            <a href="https://github.com/sganggs/Stronghold-Protocol/blob/master/NOTICE.md" target="_blank" rel="noopener noreferrer">NOTICE.md</a>
            <a href="https://github.com/sganggs/Stronghold-Protocol/blob/master/THIRD-PARTY-NOTICES.md" target="_blank" rel="noopener noreferrer">${t('第三方组件许可')}</a>
          </nav>
        </article>` : null}
        ${view.notices.map((n) => html`<article key=${n.key} class="notice-card" data-notice=${n.key}>
          <p class="notice-card__meta">${n.pluginName}${n.date ? ` · ${n.date}` : ''}</p>
          <h3 class="notice-card__title">${n.title}</h3>
          <p class="notice-card__body">${n.body}</p>
        </article>`)}
      </div>
    <//>
  </span>`;
}
