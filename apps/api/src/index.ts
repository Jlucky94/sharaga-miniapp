import { buildApp, getAppConfig } from './app.js';

const config = getAppConfig();
const app = buildApp(config);

const port = Number(process.env.PORT ?? 3001);

await app.listen({ port, host: '0.0.0.0' });
app.log.info(`listening on 0.0.0.0:${port}`);
