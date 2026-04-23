import React, { useCallback, useEffect, useState } from 'react';

import type { FeedItem } from '@sharaga/contracts';

import { getFeed, likeContribution } from '../../lib/api.js';
import { StatusPanel } from '../home/StatusPanel.js';

type FeedScreenProps = {
  accessToken: string;
  currentUserId: string;
};

function FeedItemRow({
  item,
  accessToken,
  currentUserId
}: {
  item: FeedItem;
  accessToken: string;
  currentUserId: string;
}) {
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [likeError, setLikeError] = useState<string | null>(null);

  async function handleLike(contributionId: string) {
    setLiking(true);
    setLikeError(null);
    try {
      await likeContribution(accessToken, contributionId);
      setLiked(true);
    } catch (err) {
      setLikeError(err instanceof Error ? err.message : 'Не удалось отправить спасибо');
    } finally {
      setLiking(false);
    }
  }

  const time = new Date(item.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const isOwnItem = 'userId' in item && item.userId === currentUserId;

  if (item.kind === 'contribution') {
    return (
      <article className="feed-item">
        <p>
          <strong>{item.userFirstName}</strong> вложился в <em>{item.projectTitle}</em>
        </p>
        <div className="feed-meta">
          <span className="feed-time">{time}</span>
          {item.origin === 'demo' ? <span className="badge-demo">Демо</span> : null}
        </div>
        {!isOwnItem && !liked && (
          <button className="secondary-button" disabled={liking} onClick={() => void handleLike(item.id)}>
            {liking ? 'Шлем спасибо...' : 'Сказать спасибо'}
          </button>
        )}
        {liked && <span className="inline-success">Спасибо отправлено</span>}
        {likeError && <span className="inline-error">{likeError}</span>}
      </article>
    );
  }

  if (item.kind === 'unlock') {
    return (
      <article className="feed-item feed-item--highlight">
        <p>
          <strong>{item.userFirstName}</strong> открыл <em>{item.projectTitle}</em> для всех
        </p>
        <div className="feed-meta">
          <span className="feed-time">{time}</span>
          {item.origin === 'demo' ? <span className="badge-demo">Демо</span> : null}
        </div>
      </article>
    );
  }

  if (item.kind === 'benefit') {
    return (
      <article className="feed-item">
        <p>
          <strong>{item.userFirstName}</strong> забрал бонус из <em>{item.projectTitle}</em>
        </p>
        <div className="feed-meta">
          <span className="feed-time">{time}</span>
          {item.origin === 'demo' ? <span className="badge-demo">Демо</span> : null}
        </div>
      </article>
    );
  }

  if (item.kind === 'like') {
    return (
      <article className="feed-item">
        <p>
          <strong>{item.userFirstName}</strong> сказал спасибо за вклад в <em>{item.projectTitle}</em>
        </p>
        <div className="feed-meta">
          <span className="feed-time">{time}</span>
          {item.origin === 'demo' ? <span className="badge-demo">Демо</span> : null}
        </div>
      </article>
    );
  }

  if (item.kind === 'exam_result') {
    return (
      <article className="feed-item feed-item--highlight">
        <p>
          <strong>{item.ownerFirstName}</strong> вывел пати на экзамен: {item.outcome === 'success' ? 'сдали' : 'вытащили частично'}
        </p>
        <div className="feed-meta">
          <span className="feed-time">{time}</span>
          {item.origin === 'demo' ? <span className="badge-demo">Демо</span> : null}
        </div>
        <p>{item.summary}</p>
      </article>
    );
  }

  return null;
}

export function FeedScreen({ accessToken, currentUserId }: FeedScreenProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getFeed(accessToken);
      setItems(data.items);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Не удалось загрузить ленту');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => { void load(); }, 15_000);
    return () => { window.clearInterval(interval); };
  }, [load]);

  if (loading) {
    return <StatusPanel title="Подгружаем ленту" message="Собираем последние социальные следы кампуса." tone="checking" />;
  }

  if (errorMessage && items.length === 0) {
    return (
      <StatusPanel
        title="Лента временно недоступна"
        message={errorMessage}
        tone="error"
        actionLabel="Обновить ленту"
        onAction={() => {
          setLoading(true);
          setErrorMessage(null);
          void load();
        }}
      />
    );
  }

  const hasDemoItems = items.some((item) => item.origin === 'demo');

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <span className="eyebrow">Лента кампуса</span>
        <h1>Здесь видно, кто реально двигает кампус.</h1>
        <p>Вклады, открытия и спасибо остаются тут на виду. Если чей-то вклад тебе помог - не жмись, поблагодари.</p>
        {hasDemoItems ? <p className="inline-note">Часть активности помечена как демо, чтобы кампус не выглядел пустым на первом входе.</p> : null}
      </section>

      {errorMessage ? <p className="inline-error">{errorMessage}</p> : null}

      <section className="feed-list">
        {items.length === 0 ? (
          <p>Пока тихо. Впишись в первый проект и запусти движ.</p>
        ) : (
          items.map((item) => (
            <FeedItemRow
              key={item.id}
              item={item}
              accessToken={accessToken}
              currentUserId={currentUserId}
            />
          ))
        )}
      </section>
    </main>
  );
}
