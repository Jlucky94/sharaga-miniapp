import React, { useCallback, useEffect, useState } from 'react';

import type { FeedItem } from '@sharaga/contracts';

import { getFeed, likeContribution } from '../../lib/api.js';

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
      setLikeError(err instanceof Error ? err.message : 'Failed to like');
    } finally {
      setLiking(false);
    }
  }

  const time = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isOwnItem = item.userId === currentUserId;

  if (item.kind === 'contribution') {
    return (
      <article className="feed-item">
        <p>
          <strong>{item.userFirstName}</strong> contributed to <em>{item.projectTitle}</em>
        </p>
        <span className="feed-time">{time}</span>
        {!isOwnItem && !liked && (
          <button className="secondary-button" disabled={liking} onClick={() => void handleLike(item.id)}>
            {liking ? 'Thanking...' : 'Thank'}
          </button>
        )}
        {liked && <span className="inline-success">Thanked</span>}
        {likeError && <span className="inline-error">{likeError}</span>}
      </article>
    );
  }

  if (item.kind === 'unlock') {
    return (
      <article className="feed-item feed-item--highlight">
        <p>
          <strong>{item.userFirstName}</strong> unlocked <em>{item.projectTitle}</em> for everyone!
        </p>
        <span className="feed-time">{time}</span>
      </article>
    );
  }

  if (item.kind === 'benefit') {
    return (
      <article className="feed-item">
        <p>
          <strong>{item.userFirstName}</strong> used the benefit from <em>{item.projectTitle}</em>
        </p>
        <span className="feed-time">{time}</span>
      </article>
    );
  }

  if (item.kind === 'like') {
    return (
      <article className="feed-item">
        <p>
          <strong>{item.userFirstName}</strong> thanked a contribution to <em>{item.projectTitle}</em>
        </p>
        <span className="feed-time">{time}</span>
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
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load feed');
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
    return (
      <main className="app-shell">
        <section className="hero-panel hero-panel--checking">
          <span className="eyebrow">Feed</span>
          <h1>Loading feed...</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <span className="eyebrow">Social Feed</span>
        <h1>What the campus is doing.</h1>
        <p>Contributions and gratitude leave a visible trace here. Thank someone if their work helped you.</p>
      </section>

      {errorMessage ? <p className="inline-error">{errorMessage}</p> : null}

      <section className="feed-list">
        {items.length === 0 ? (
          <p>No activity yet. Be the first to contribute to a campus project.</p>
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
