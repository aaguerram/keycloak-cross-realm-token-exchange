import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3003);
const server = createApp().listen(port, () => {
  console.log(`movimiento-api escuchando en http://0.0.0.0:${port} (Swagger: /docs)`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
