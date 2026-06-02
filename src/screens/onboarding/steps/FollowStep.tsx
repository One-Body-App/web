import { useCallback, useRef } from 'react';
import { Avatar } from '@/components/Avatar';
import { useOnboarding } from '../OnboardingContext';

/** Mirrors mobile's OnboardingInfluencers ("Select Ministries and Creators"). */
export function FollowStep() {
  const {
    suggestedUsers,
    selectedFollows,
    toggleFollow,
    loadingMoreSuggestions,
    hasMoreSuggestions,
    loadMoreSuggestedUsers,
  } = useOnboarding();

  // Always call the latest loader (its identity changes as state updates) without
  // re-subscribing the observer on every render.
  const loadMoreRef = useRef(loadMoreSuggestedUsers);
  loadMoreRef.current = loadMoreSuggestedUsers;

  // Infinite scroll via an IntersectionObserver sentinel (robust regardless of
  // which ancestor scrolls; mirrors mobile's onEndReached). Re-attaching when the
  // list length or loading state changes lets a still-visible sentinel keep paging
  // so the viewport auto-fills even when many fetched accounts are filtered out.
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!node) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            void loadMoreRef.current();
          }
        },
        { rootMargin: '300px' },
      );
      observer.observe(node);
      observerRef.current = observer;
    },
    // Latest loader is read from loadMoreRef; re-subscribe only on these so a
    // still-visible sentinel keeps paging.
    [suggestedUsers.length, loadingMoreSuggestions],
  );

  // Truly nobody to suggest (and nothing more to fetch).
  if (suggestedUsers.length === 0 && !hasMoreSuggestions && !loadingMoreSuggestions) {
    return (
      <p className="onboarding-hint">No suggestions right now. You can connect with people anytime.</p>
    );
  }

  return (
    <div className="onboarding-people-shell">
      {suggestedUsers.length > 0 ? (
        <div className="onboarding-people">
          {suggestedUsers.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`onboarding-person${selectedFollows.includes(item.id) ? ' is-selected' : ''}`}
              onClick={() => toggleFollow(item.id)}
              {...{ 'aria-pressed': selectedFollows.includes(item.id) ? 'true' : 'false' }}
            >
              <Avatar src={item.avatar} alt={item.name} size={52} verified={item.verified} />
              <strong>{item.name}</strong>
              <span>@{item.username}</span>
            </button>
          ))}
        </div>
      ) : null}

      {hasMoreSuggestions ? (
        <div ref={sentinelRef} className="onboarding-people__sentinel" aria-hidden="true" />
      ) : null}

      {loadingMoreSuggestions || (suggestedUsers.length === 0 && hasMoreSuggestions) ? (
        <p className="onboarding-hint onboarding-people__status">Loading more people&hellip;</p>
      ) : null}
    </div>
  );
}
