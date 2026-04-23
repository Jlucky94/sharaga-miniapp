export async function requestTelegramWriteAccess(): Promise<{ supported: boolean; granted: boolean }> {
  const webApp = window.Telegram?.WebApp;
  if (!webApp?.requestWriteAccess) {
    return { supported: false, granted: false };
  }

  try {
    const granted = await new Promise<boolean>((resolve) => {
      let settled = false;

      const finish = (value: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(value);
      };

      const maybePromise = webApp.requestWriteAccess?.((value?: boolean) => {
        finish(Boolean(value));
      });

      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then((value: unknown) => {
          finish(Boolean(value));
        }).catch(() => {
          finish(false);
        });
        return;
      }

      window.setTimeout(() => {
        finish(false);
      }, 4_000);
    });

    return { supported: true, granted };
  } catch (error) {
    console.warn('requestWriteAccess failed', error);
    return { supported: true, granted: false };
  }
}
