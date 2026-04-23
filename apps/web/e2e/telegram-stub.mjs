import { createServer } from 'node:http';

const port = Number(process.env.TELEGRAM_STUB_PORT ?? 3002);

const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (request.method === 'POST' && request.url?.includes('/sendMessage')) {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        ok: true,
        result: {
          message_id: 1,
          echoed: body ? JSON.parse(body) : null
        }
      }));
    });
    return;
  }

  response.writeHead(404, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ ok: false, description: 'Not found' }));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Telegram stub listening on 127.0.0.1:${port}`);
});

const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
