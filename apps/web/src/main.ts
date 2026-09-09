import './style.css';
import { mountPage } from './page';
import type { WebConfig } from './config';

declare const __WEB_CONFIG__: WebConfig;

void mountPage(document.querySelector<HTMLElement>('#app')!, __WEB_CONFIG__, {
  pathname: window.location.pathname,
  userAgent: navigator.userAgent,
  maxTouchPoints: navigator.maxTouchPoints,
  fetch: window.fetch.bind(window),
  replace: (url) => window.location.replace(url),
});
