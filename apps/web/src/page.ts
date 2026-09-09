import type { WebConfig } from './config';

type Platform = 'ios' | 'android' | 'desktop';
type Environment = {
  pathname: string;
  userAgent: string;
  maxTouchPoints: number;
  fetch: typeof fetch;
  replace(url: string): void;
};

export function platform(userAgent: string, maxTouchPoints = 0): Platform {
  if (
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
  )
    return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'desktop';
}

export async function mountPage(
  root: HTMLElement,
  config: WebConfig,
  env: Environment,
) {
  const document = root.ownerDocument;
  const show = (html: string, busy = false) => {
    root.innerHTML = html;
    root.setAttribute('aria-busy', String(busy));
  };
  const unavailable = () =>
    show(`
    <section class="message">
      <p class="eyebrow">INVITATION</p>
      <h1>この招待リンクは<br>利用できません</h1>
      <p>期限切れ、または無効化されている可能性があります。<br>招待した人から新しいリンクを受け取ってください。</p>
      <a class="button" href="/">トップに戻る</a>
    </section>`);
  const downloads = (invite: boolean) => {
    show(`
      <section class="download">
        <p class="eyebrow">${invite ? 'YOU’RE INVITED' : 'STAMP RALLY'}</p>
        <h1>${invite ? '旅の招待が届いています' : '旅の思い出を、一緒に。'}</h1>
        <p class="intro">${invite ? 'アプリをインストールして、この招待リンクをもう一度開いてください。' : 'stamp rallyをダウンロード'}</p>
        <div class="stores"></div>
        <p class="footnote">${invite ? 'ログイン後に招待内容を確認できます。参加には申請と承認が必要です。' : 'スマートフォンのカメラでQRコードを読み取ってください。'}</p>
      </section>`);
    const stores = root.querySelector('.stores')!;
    for (const store of [
      {
        id: 'ios',
        name: 'App Store',
        badge: '/badges/app-store.svg',
        url: config.iosStoreUrl,
      },
      {
        id: 'android',
        name: 'Google Play',
        badge: '/badges/google-play.png',
        url: config.androidStoreUrl,
      },
    ]) {
      const card = document.createElement('section');
      card.className = 'store';
      const heading = document.createElement('h2');
      heading.textContent = store.name;
      card.append(heading);
      if (store.url) {
        const link = document.createElement('a');
        link.href = store.url;
        link.className = 'badge-link';
        const badge = document.createElement('img');
        badge.className = 'badge ' + store.id;
        badge.src = store.badge;
        badge.alt = store.name + 'からダウンロード';
        link.append(badge);
        const qr = document.createElement('img');
        qr.className = 'qr';
        qr.src = '/qr/' + store.id + '.png';
        qr.alt = store.name + 'のダウンロード用QRコード';
        qr.width = 192;
        qr.height = 192;
        card.append(link, qr);
      } else {
        const status = document.createElement('p');
        status.className = 'coming-soon';
        status.textContent = '配信準備中';
        card.append(status);
      }
      stores.append(card);
    }
    const os = platform(env.userAgent, env.maxTouchPoints);
    const url =
      os === 'ios'
        ? config.iosStoreUrl
        : os === 'android'
          ? config.androidStoreUrl
          : null;
    if (url) env.replace(url);
  };

  if (env.pathname === '/') {
    downloads(false);
    return;
  }
  const match = env.pathname.match(/^\/invite\/([A-Za-z0-9_-]{43})\/?$/);
  if (!match) {
    unavailable();
    return;
  }
  const check = async (): Promise<void> => {
    show(
      '<section class="message"><p>招待リンクを確認しています…</p></section>',
      true,
    );
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 10000);
    try {
      if (!config.apiUrl) throw new Error('API is not configured');
      const response = await env.fetch(
        config.apiUrl + '/public/invitation-links/status',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: match[1] }),
          credentials: 'omit',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
          signal: abort.signal,
        },
      );
      if (!response.ok) throw new Error('Status request failed');
      const result: unknown = await response.json();
      const status =
        result && typeof result === 'object' && 'status' in result
          ? result.status
          : null;
      if (status === 'ACTIVE') downloads(true);
      else if (['EXPIRED', 'REVOKED', 'NOT_FOUND'].includes(String(status)))
        unavailable();
      else throw new Error('Unknown invitation status');
    } catch {
      show(`
        <section class="message">
          <h1>招待リンクを確認できませんでした</h1>
          <p>通信環境を確認して、もう一度お試しください。</p>
          <button class="button" type="button">再試行</button>
          <a class="text-link" href="/">トップに戻る</a>
        </section>`);
      root
        .querySelector('button')!
        .addEventListener('click', () => void check(), { once: true });
    } finally {
      clearTimeout(timeout);
    }
  };
  await check();
}
