import type { UIEvent } from 'react';
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

  function handlePeopleScroll(event: UIEvent<HTMLDivElement>) {
    if (loadingMoreSuggestions || !hasMoreSuggestions) {
      return;
    }

    const target = event.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (distanceFromBottom < 240) {
      void loadMoreSuggestedUsers();
    }
  }

  if (suggestedUsers.length === 0) {
    return <p className="onboarding-hint">No suggestions right now — you can follow people anytime.</p>;
  }

  return (
    <div className="onboarding-people-shell" onScroll={handlePeopleScroll}>
      <div className="onboarding-people">
        {suggestedUsers.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`onboarding-person${selectedFollows.includes(item.id) ? ' is-selected' : ''}`}
            onClick={() => toggleFollow(item.id)}
            {...{ 'aria-pressed': selectedFollows.includes(item.id) ? 'true' : 'false' }}
          >
            <img src={item.avatar} alt="" />
            <strong>{item.name}</strong>
            <span>@{item.username}</span>
          </button>
        ))}
      </div>
      {loadingMoreSuggestions ? (
        <p className="onboarding-hint onboarding-people__status">Loading more people...</p>
      ) : null}
    </div>
  );
}
