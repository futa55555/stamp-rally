import {
  Controller,
  Get,
  Header,
  Param,
  Req,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!,
  );
function httpsUrl(value?: string) {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('Expected an HTTPS URL');
  return url;
}

@Controller()
export class InvitationWebController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private requireHost(req: Request) {
    const origin = this.config.get<string>('INVITATION_PUBLIC_ORIGIN');
    const url = httpsUrl(origin);
    if (
      !url ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.port ||
      req.hostname !== url.hostname
    )
      throw new ServiceUnavailableException(
        'Invitation domain is not configured for this host',
      );
  }

  @Get('.well-known/apple-app-site-association')
  @Header('Content-Type', 'application/json')
  @Header('Cache-Control', 'public, max-age=300')
  apple(@Req() req: Request) {
    this.requireHost(req);
    const appId = this.config.get<string>('INVITATION_IOS_APP_ID')?.trim();
    if (!appId || !/^[A-Z0-9]+\.[A-Za-z0-9.-]+$/.test(appId))
      throw new ServiceUnavailableException(
        'INVITATION_IOS_APP_ID is required',
      );
    return {
      applinks: {
        details: [{ appIDs: [appId], components: [{ '/': '/invite/*' }] }],
      },
    };
  }

  @Get('.well-known/assetlinks.json')
  @Header('Content-Type', 'application/json')
  @Header('Cache-Control', 'public, max-age=300')
  android(@Req() req: Request) {
    this.requireHost(req);
    const packageName = this.config
      .get<string>('INVITATION_ANDROID_PACKAGE')
      ?.trim();
    const fingerprints = (
      this.config.get<string>('INVITATION_ANDROID_SHA256') ?? ''
    )
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (
      !packageName ||
      !/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(
        packageName,
      ) ||
      !fingerprints.length ||
      fingerprints.some(
        (value) => !/^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/.test(value),
      )
    )
      throw new ServiceUnavailableException(
        'Android association credentials are required',
      );
    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ];
  }

  @Get('invite/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  )
  async landing(
    @Param('token') token: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.requireHost(req);
    const link = /^[A-Za-z0-9_-]{43}$/.test(token)
      ? await this.prisma.invitationLink.findUnique({
          where: {
            tokenHash: createHash('sha256').update(token).digest('hex'),
          },
          select: { expiresAt: true, revokedAt: true },
        })
      : null;
    const active =
      link && !link.revokedAt && link.expiresAt.getTime() > Date.now();
    res.status(active ? 200 : link ? 410 : 404);
    const scheme = this.config.get<string>('INVITATION_APP_SCHEME')?.trim();
    const openUrl =
      active && scheme && /^stamp-rally(?:-dev|-stg|-local)?$/.test(scheme)
        ? scheme + '://invite/' + token
        : null;
    const ios = httpsUrl(
      this.config.get<string>('INVITATION_IOS_INSTALL_URL'),
    )?.href;
    const android = httpsUrl(
      this.config.get<string>('INVITATION_ANDROID_INSTALL_URL'),
    )?.href;
    const button = (label: string, url: string, secondary = false) =>
      '<a class="' +
      (secondary ? 'secondary' : 'primary') +
      '" href="' +
      escapeHtml(url) +
      '">' +
      label +
      '</a>';
    // No trip/user data or third-party assets are exposed by public previews.
    return (
      '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>旅行への招待 | Stamp Rally</title><style>' +
      '*{box-sizing:border-box}body{margin:0;background:#f7f6f2;color:#26372f;font-family:system-ui,sans-serif;line-height:1.8;min-height:100svh;display:grid;place-items:center;padding:24px}' +
      'main{max-width:460px;width:100%;background:white;border:1px solid #e2e6df;border-radius:24px;padding:32px}small{letter-spacing:.16em;color:#58755d;font-weight:700}h1{line-height:1.4;font-size:28px;margin:24px 0 16px}' +
      'p{color:#5c665e}a{display:block;text-align:center;text-decoration:none;border-radius:14px;padding:12px;margin:12px 0;font-weight:600}.primary{background:#386647;color:white}.secondary{border:1px solid #cdd8cc;color:#386647}ol{padding-left:24px}footer{font-size:13px;margin-top:24px;color:#727c74}</style></head><body><main><small>STAMP RALLY</small>' +
      (active
        ? '<h1>一緒に、旅の記録を。</h1><p>アプリで招待内容を確認し、参加を申請してください。旅行の参加者が承認すると参加が確定します。</p>' +
          (openUrl ? button('アプリで開く', openUrl) : '') +
          '<ol><li>アプリをインストールする</li><li>この招待リンクをもう一度開く</li><li>ログインして参加を申請する</li></ol>' +
          (ios ? button('iPhoneにインストール', ios, true) : '') +
          (android ? button('Androidにインストール', android, true) : '') +
          (!ios && !android ? '<p>アプリの配布は準備中です。</p>' : '') +
          '<footer>アプリが開かない場合は、ブラウザでこのページを開いて「アプリで開く」を押してください。</footer>'
        : '<h1>この招待リンクは利用できません</h1><p>期限切れ、または無効化されている可能性があります。招待した人から新しいリンクを受け取ってください。</p><p>すでに申請済みの場合は、アプリの「参加申請」で状況を確認できます。</p>') +
      '</main></body></html>'
    );
  }
}
