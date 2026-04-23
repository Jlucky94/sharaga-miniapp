export type TelegramMessageSender = (args: { chatId: number; text: string }) => Promise<void>;

const TELEGRAM_SEND_TIMEOUT_MS = 5_000;

export function createTelegramMessageSender(
  botToken: string,
  options: { apiBaseUrl?: string } = {}
): TelegramMessageSender {
  const apiBaseUrl = (options.apiBaseUrl ?? 'https://api.telegram.org').replace(/\/+$/, '');

  return async ({ chatId, text }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, TELEGRAM_SEND_TIMEOUT_MS);

    try {
      const response = await fetch(`${apiBaseUrl}/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text
        }),
        signal: controller.signal
      });

      const payload = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
      if (!response.ok || payload?.ok === false) {
        const description = payload?.description ?? `HTTP ${response.status}`;
        throw new Error(`TELEGRAM_SEND_FAILED:${description}`);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`TELEGRAM_SEND_FAILED:TIMEOUT_${TELEGRAM_SEND_TIMEOUT_MS}MS`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };
}
