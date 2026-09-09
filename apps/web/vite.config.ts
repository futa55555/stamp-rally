import { defineConfig, loadEnv } from 'vite';
import { buildConfig } from './build/config.ts';
import { buildAssets } from './build/assets.ts';
import { associationAssets } from './build/associations.ts';

export default defineConfig(({ mode }) => {
  const config = buildConfig(loadEnv(mode, process.cwd(), 'WEB_'));
  return {
    define: { __WEB_CONFIG__: JSON.stringify(config) },
    plugins: [
      {
        name: 'static-pages-assets',
        async generateBundle() {
          for (const [fileName, source] of Object.entries({
            ...(await buildAssets(config)),
            ...(await associationAssets(mode)),
          }))
            this.emitFile({ type: 'asset', fileName, source });
        },
        async configureServer(server) {
          const assets = {
            ...(await buildAssets(config)),
            ...(await associationAssets(mode)),
          };
          server.middlewares.use((req, res, next) => {
            const path = req.url?.split('?')[0].slice(1) ?? '';
            const source = assets[path];
            if (source === undefined || path.startsWith('_')) return next();
            res.setHeader(
              'Content-Type',
              path.endsWith('.png')
                ? 'image/png'
                : path.endsWith('.html')
                  ? 'text/html; charset=utf-8'
                  : 'application/json',
            );
            res.end(source);
          });
        },
      },
    ],
  };
});
