// 운영 Worker 진입점(wrangler.jsonc 의 main). 요청은 Astro 핸들러가 처리하고, 하루 한 번 예약 실행이 만료된 기록을 지운다.
import { handle } from '@astrojs/cloudflare/handler';
import { purgeExpiredLogs } from './lib/maintenance/log-retention';

export default {
  fetch: handle,
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      purgeExpiredLogs(env.DB).then(
        (purged) => console.log(JSON.stringify({ event: 'log_retention_purged', ...purged })),
        (error) => {
          console.error(JSON.stringify({ event: 'log_retention_failed' }));
          throw error;
        },
      ),
    );
  },
} satisfies ExportedHandler<Env>;
