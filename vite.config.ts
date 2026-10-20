import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

/** En desenvolupament, serveix /api/prereserva amb la mateixa Netlify Function de producció.
 *  Les variables de servidor (SUPABASE_SERVICE_ROLE_KEY, etc.) es llegeixen de .env.local. */
function netlifyFunctionsDev(): Plugin {
  return {
    name: 'netlify-functions-dev',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''));
      const routes: Record<string, string> = {
        '/api/prereserva': '/netlify/functions/create-booking.ts',
        '/api/contacte': '/netlify/functions/create-lead.ts',
      };
      server.middlewares.use(async (req, res, next) => {
        const fn = routes[(req.url ?? '').split('?')[0]];
        if (!fn) return next();
        try {
          const mod = await server.ssrLoadModule(fn);
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const request = new Request(`http://localhost${req.originalUrl ?? req.url}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
          });
          const response: Response = await mod.default(request, { ip: req.socket.remoteAddress });
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(await response.text());
        } catch (e) {
          console.error('[api] ', e);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'SERVER_ERROR' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), netlifyFunctionsDev()],
  server: { port: 5173 },
});
