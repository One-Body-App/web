import { lazy, Suspense, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  ExternalLink,
  Film,
  Heart,
  MessageCircle,
  Play,
  Send,
  SlidersHorizontal,
  Smartphone,
  X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { EmptyState, PageHeader } from "@/components/ui";
import { useApiQuery } from "@/api/useApi";
import {
  watchApi,
  type SermonComment,
  type SermonEngagement,
  type SermonFilters,
  type SermonVideo,
  type WatchVideo,
} from "@/api/watch";
import "./watch.css";

// Defer the player (and hls.js) until a video is opened.
const WatchLightbox = lazy(() =>
  import("@/components/WatchLightbox").then((m) => ({
    default: m.WatchLightbox,
  })),
);

type WatchTab = "foryou" | "sermons";
type SermonListItem = SermonVideo & Partial<SermonEngagement>;

const DEFAULT_SERMON_FILTERS: SermonFilters = {
  search: "",
  provider: "",
  channelId: "",
  speaker: "",
  denomination: "",
  topic: "",
  duration: "",
  publishedRange: "",
  sort: "recent",
  page: 1,
  limit: 24,
};

const SERMON_PROVIDERS = [
  { label: "All", value: "" },
  { label: "YouTube", value: "youtube" },
  { label: "Vimeo", value: "vimeo" },
] as const;

const SERMON_DURATIONS = [
  { label: "Any length", value: "" },
  { label: "< 30m", value: "short" },
  { label: "30-60m", value: "medium" },
  { label: "60m+", value: "long" },
] as const;

const SERMON_RANGES = [
  { label: "Any time", value: "" },
  { label: "This week", value: "week" },
  { label: "This month", value: "month" },
  { label: "This year", value: "year" },
] as const;

const SERMON_SORTS = [
  { label: "Recent", value: "recent" },
  { label: "Oldest", value: "oldest" },
  { label: "Title", value: "title" },
  { label: "Confidence", value: "confidence" },
] as const;

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function fmtDur(ms?: number) {
  if (!ms) return "";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtSermonDur(seconds?: number) {
  if (!seconds) return "";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Only true 9:16 verticals are "shorts" (mirrors the mobile app's 0.04
 * tolerance). Everything else — 1:1, 4:3, 16:9, 4:5, … — is a "wide" video.
 */
const isShort = (v: WatchVideo) => Math.abs(v.aspectRatio - 9 / 16) <= 0.05;

export function Watch() {
  const [tab, setTab] = useState<WatchTab>("foryou");
  const [active, setActive] = useState<WatchVideo | null>(null);
  const [activeSermon, setActiveSermon] = useState<SermonListItem | null>(null);
  const [sermonFilters, setSermonFilters] = useState<SermonFilters>(
    DEFAULT_SERMON_FILTERS,
  );
  const [draftSermonFilters, setDraftSermonFilters] = useState<SermonFilters>(
    DEFAULT_SERMON_FILTERS,
  );
  const [sermonFiltersOpen, setSermonFiltersOpen] = useState(false);
  const [sermonEngagementOverrides, setSermonEngagementOverrides] = useState<
    Record<string, Partial<SermonEngagement>>
  >({});
  const { data, loading } = useApiQuery(() => watchApi.feed(1));
  const { data: sermonsData, loading: sermonsLoading } = useApiQuery(
    (signal) => watchApi.sermons(sermonFilters, signal),
    { enabled: tab === "sermons", deps: [sermonFilters] },
  );
  const { data: sermonOptions } = useApiQuery(
    (signal) => watchApi.sermonFilterOptions(signal),
    { enabled: tab === "sermons" },
  );
  const list = data ?? [];
  const sermons = sermonsData ?? [];
  const sermonIdKey = sermons.map((sermon) => sermon.id).join(",");
  const { data: sermonEngagementData } = useApiQuery(
    (signal) =>
      watchApi.sermonEngagement(
        sermons.map((sermon) => sermon.id),
        signal,
      ),
    {
      enabled: tab === "sermons" && sermons.length > 0,
      deps: [sermonIdKey],
      fallback: [],
    },
  );
  const sermonEngagementById = new Map(
    (sermonEngagementData ?? []).map((item) => [item.id, item]),
  );
  const visibleSermons: SermonListItem[] = sermons.map((sermon) => ({
    ...sermon,
    ...(sermonEngagementById.get(sermon.id) ?? {}),
    ...(sermonEngagementOverrides[sermon.id] ?? {}),
  }));

  const shorts = list.filter(isShort);
  const wide = list.filter((v) => !isShort(v));

  function openSermonFilters() {
    setDraftSermonFilters(sermonFilters);
    setSermonFiltersOpen(true);
  }

  function updateDraft<K extends keyof SermonFilters>(
    key: K,
    value: SermonFilters[K],
  ) {
    setDraftSermonFilters((previous) => ({
      ...previous,
      [key]: value,
      page: 1,
    }));
  }

  function applySermonFilters() {
    setSermonFilters({ ...draftSermonFilters, page: 1 });
    setSermonFiltersOpen(false);
  }

  function resetSermonFilters() {
    setDraftSermonFilters(DEFAULT_SERMON_FILTERS);
    setSermonFilters(DEFAULT_SERMON_FILTERS);
  }

  function patchSermonEngagement(id: string, patch: Partial<SermonEngagement>) {
    setSermonEngagementOverrides((previous) => ({
      ...previous,
      [id]: {
        ...(previous[id] ?? {}),
        ...patch,
      },
    }));
    setActiveSermon((previous) =>
      previous?.id === id ? { ...previous, ...patch } : previous,
    );
  }

  return (
    <div className="watch">
      <PageHeader
        title="Watch"
        subtitle="Sermons, shorts & moments from across the Body."
      />

      <div className="segmented watch__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "foryou" ? "true" : "false"}
          className={`segmented__item${tab === "foryou" ? " is-active" : ""}`}
          onClick={() => setTab("foryou")}
        >
          For You
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "sermons" ? "true" : "false"}
          className={`segmented__item${tab === "sermons" ? " is-active" : ""}`}
          onClick={() => setTab("sermons")}
        >
          Sermons
        </button>
      </div>

      {tab === "sermons" ? (
        <section className="watch-sermons-panel">
          <div className="watch-sermons-toolbar">
            <div>
              <h2>Sermons</h2>
              <p>Public, approved sermon videos from YouTube and Vimeo.</p>
            </div>
            <button
              type="button"
              className="btn btn--outline"
              onClick={openSermonFilters}
            >
              <SlidersHorizontal size={17} /> Filters
            </button>
          </div>

          {sermonsLoading ? (
            <WatchSkeleton />
          ) : visibleSermons.length ? (
            <div className="watch-sermons">
              {visibleSermons.map((sermon, i) => (
                <SermonCard
                  key={sermon.id}
                  sermon={sermon}
                  index={i}
                  onOpen={setActiveSermon}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Film size={30} />}
              title="No sermons yet"
              body="Approved full messages and teachings will show up here."
            />
          )}
        </section>
      ) : loading && !data ? (
        <WatchSkeleton />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Film size={30} />}
          title="No videos yet"
          body="New videos from across the Body will show up here."
        />
      ) : (
        <div className="watch-split">
          <section className="watch-col">
            <h2 className="watch-col__head">
              <Smartphone size={16} /> Shorts
            </h2>
            {shorts.length ? (
              <div className="watch-shorts">
                {shorts.map((v, i) => (
                  <ShortCard
                    key={v.id}
                    video={v}
                    index={i}
                    onOpen={setActive}
                  />
                ))}
              </div>
            ) : (
              <p className="watch-col__empty">No shorts right now.</p>
            )}
          </section>

          <section className="watch-col">
            <h2 className="watch-col__head">
              <Film size={16} /> Videos
            </h2>
            {wide.length ? (
              <div className="watch-videos">
                {wide.map((v, i) => (
                  <WideCard key={v.id} video={v} index={i} onOpen={setActive} />
                ))}
              </div>
            ) : (
              <p className="watch-col__empty">No videos right now.</p>
            )}
          </section>
        </div>
      )}

      <AnimatePresence>
        {active ? (
          <Suspense fallback={null}>
            <WatchLightbox video={active} onClose={() => setActive(null)} />
          </Suspense>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {activeSermon ? (
          <SermonLightbox
            sermon={activeSermon}
            onClose={() => setActiveSermon(null)}
            onEngagementChange={patchSermonEngagement}
          />
        ) : null}
      </AnimatePresence>

      {sermonFiltersOpen ? (
        <dialog
          className="sermon-filter-modal"
          aria-label="Sermon filters"
          open
        >
          <button
            type="button"
            className="sermon-filter-modal__backdrop"
            aria-label="Close sermon filters"
            onClick={() => setSermonFiltersOpen(false)}
          />
          <div className="sermon-filter-modal__sheet">
            <div className="sermon-filter-modal__head">
              <div>
                <h2>Sermon filters</h2>
                <p>Refine the Watch portal sermon tab.</p>
              </div>
              <button
                type="button"
                onClick={() => setSermonFiltersOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <label className="sermon-filter-field sermon-filter-field--wide">
              <span>Search</span>
              <input
                value={draftSermonFilters.search ?? ""}
                onChange={(event) => updateDraft("search", event.target.value)}
                placeholder="Title, channel, speaker, topic"
              />
            </label>
            <FilterSelect
              label="Provider"
              value={draftSermonFilters.provider ?? ""}
              options={SERMON_PROVIDERS}
              onChange={(value) => updateDraft("provider", value)}
            />
            <FilterSelect
              label="Duration"
              value={draftSermonFilters.duration ?? ""}
              options={SERMON_DURATIONS}
              onChange={(value) => updateDraft("duration", value)}
            />
            <FilterSelect
              label="Published"
              value={draftSermonFilters.publishedRange ?? ""}
              options={SERMON_RANGES}
              onChange={(value) => updateDraft("publishedRange", value)}
            />
            <FilterSelect
              label="Sort"
              value={draftSermonFilters.sort ?? "recent"}
              options={SERMON_SORTS}
              onChange={(value) => updateDraft("sort", value)}
            />
            <TextFilter
              label="Speaker"
              value={draftSermonFilters.speaker ?? ""}
              suggestions={sermonOptions?.speakers ?? []}
              onChange={(value) => updateDraft("speaker", value)}
            />
            <TextFilter
              label="Denomination"
              value={draftSermonFilters.denomination ?? ""}
              suggestions={sermonOptions?.denominations ?? []}
              onChange={(value) => updateDraft("denomination", value)}
            />
            <TextFilter
              label="Topic"
              value={draftSermonFilters.topic ?? ""}
              suggestions={sermonOptions?.topics ?? []}
              onChange={(value) => updateDraft("topic", value)}
            />
            <TextFilter
              label="Channel ID"
              value={draftSermonFilters.channelId ?? ""}
              suggestions={[]}
              onChange={(value) => updateDraft("channelId", value)}
            />
            <div className="sermon-filter-modal__actions">
              <button
                type="button"
                className="btn btn--outline"
                onClick={resetSermonFilters}
              >
                Reset
              </button>
              <button
                type="button"
                className="btn btn--accent"
                onClick={applySermonFilters}
              >
                Apply filters
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}

/* ----------------------------- Cards ----------------------------- */
function ShortCard({
  video,
  index,
  onOpen,
}: {
  video: WatchVideo;
  index: number;
  onOpen: (v: WatchVideo) => void;
}) {
  return (
    <button
      type="button"
      className="wshort"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      onClick={() => onOpen(video)}
      aria-label={`Play ${video.title || "short"}`}
    >
      <img
        className="wshort__img"
        src={video.thumbnail}
        alt=""
        loading="lazy"
      />
      <span className="wshort__shade" />
      <span className="wshort__play">
        <Play size={18} fill="currentColor" />
      </span>
      {video.durationMs ? (
        <span className="wshort__dur">{fmtDur(video.durationMs)}</span>
      ) : null}
      <span className="wshort__cap">
        <strong>{video.title || video.caption || video.authorName}</strong>
        <span className="wshort__by">
          <Avatar src={video.authorAvatar} alt={video.authorName} size={18} />{" "}
          {video.authorName}
        </span>
      </span>
    </button>
  );
}

function WideCard({
  video,
  index,
  onOpen,
  large = false,
}: {
  video: WatchVideo;
  index: number;
  onOpen: (v: WatchVideo) => void;
  large?: boolean;
}) {
  return (
    <article
      className={`wwide card${large ? " wwide--lg" : ""}`}
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <button
        type="button"
        className="wwide__frame"
        style={{ aspectRatio: String(video.aspectRatio || 16 / 9) }}
        onClick={() => onOpen(video)}
        aria-label={`Play ${video.title || "video"}`}
      >
        <img src={video.thumbnail} alt="" loading="lazy" />
        <span className="wwide__play">
          <Play size={22} fill="currentColor" />
        </span>
        {video.durationMs ? (
          <span className="wwide__dur">{fmtDur(video.durationMs)}</span>
        ) : null}
      </button>
      <div className="wwide__meta">
        <Avatar src={video.authorAvatar} alt={video.authorName} size={36} />
        <div className="wwide__info">
          <strong>{video.title || video.authorName}</strong>
          {large && video.caption ? <p>{video.caption}</p> : null}
          <span className="wwide__by">
            {video.authorName} · {video.time}
          </span>
        </div>
        <span className="wwide__count">
          <Heart size={15} /> {formatCount(video.reactions)}
        </span>
      </div>
    </article>
  );
}

function SermonCard({
  sermon,
  index,
  onOpen,
}: {
  sermon: SermonListItem;
  index: number;
  onOpen: (sermon: SermonListItem) => void;
}) {
  const duration = fmtSermonDur(sermon.durationSeconds);
  const date = sermon.publishedAt ? timeAgo(sermon.publishedAt) : "";
  const reactions = Number(sermon.reactionsCount ?? 0);
  const comments = Number(sermon.commentsCount ?? sermon.commentNumber ?? 0);
  return (
    <article
      className="sermon-card card"
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <button
        type="button"
        className="sermon-card__frame"
        onClick={() => onOpen(sermon)}
        aria-label={`Play ${sermon.title || "sermon"}`}
      >
        {sermon.thumbnailUrl ? (
          <img src={sermon.thumbnailUrl} alt="" loading="lazy" />
        ) : null}
        <span className="sermon-card__play">
          <Play size={22} fill="currentColor" />
        </span>
        {duration ? <span className="sermon-card__dur">{duration}</span> : null}
      </button>
      <div className="sermon-card__meta">
        <div className="sermon-card__badges">
          <span>{sermon.provider}</span>
          {sermon.denomination ? <span>{sermon.denomination}</span> : null}
        </div>
        <strong>{sermon.title || "Untitled sermon"}</strong>
        <p>
          {sermon.speaker || sermon.channelName || "Original source"}
          {date ? ` · ${date}` : ""}
        </p>
        {sermon.topics?.length ? (
          <small>{sermon.topics.slice(0, 4).join(" · ")}</small>
        ) : null}
        <div className="sermon-card__counts">
          <span>
            <Heart size={14} /> {formatCount(reactions)}
          </span>
          <span>
            <MessageCircle size={14} /> {formatCount(comments)}
          </span>
        </div>
      </div>
    </article>
  );
}

function SermonLightbox({
  sermon,
  onClose,
  onEngagementChange,
}: {
  sermon: SermonListItem;
  onClose: () => void;
  onEngagementChange: (id: string, patch: Partial<SermonEngagement>) => void;
}) {
  const [liked, setLiked] = useState(Boolean(sermon.hasReacted));
  const [reactionCount, setReactionCount] = useState(
    Number(sermon.reactionsCount ?? 0),
  );
  const [commentCount, setCommentCount] = useState(
    Number(sermon.commentsCount ?? sermon.commentNumber ?? 0),
  );
  const [commentText, setCommentText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [createdComments, setCreatedComments] = useState<SermonComment[]>([]);
  const { data: fetchedComments } = useApiQuery(
    (signal) => watchApi.sermonComments(sermon.id, signal),
    { deps: [sermon.id], fallback: [] },
  );
  const comments = [...(fetchedComments ?? []), ...createdComments];

  function toggleReaction() {
    const nextLiked = !liked;
    const nextCount = Math.max(0, reactionCount + (nextLiked ? 1 : -1));
    setFeedback("");
    setLiked(nextLiked);
    setReactionCount(nextCount);
    onEngagementChange(sermon.id, {
      hasReacted: nextLiked,
      userReaction: nextLiked ? "love" : "",
      reactionsCount: nextCount,
    });
    const request = nextLiked
      ? watchApi.reactToSermon(sermon.id, "love")
      : watchApi.removeSermonReaction(sermon.id);
    request
      .then((updated) => {
        const confirmedCount = Number(updated.reactionsCount ?? nextCount);
        setReactionCount(confirmedCount);
        onEngagementChange(sermon.id, {
          hasReacted: nextLiked,
          userReaction: nextLiked ? "love" : "",
          reactionsCount: confirmedCount,
          reactionSummary: updated.reactionSummary ?? sermon.reactionSummary,
        });
      })
      .catch((error: unknown) => {
        const status =
          typeof (error as { status?: unknown }).status === "number"
            ? (error as { status: number }).status
            : 0;
        setLiked(!nextLiked);
        setReactionCount(reactionCount);
        onEngagementChange(sermon.id, {
          hasReacted: !nextLiked,
          userReaction: !nextLiked ? "love" : "",
          reactionsCount: reactionCount,
        });
        setFeedback(
          status === 401
            ? "Sign in to react to sermons."
            : "Unable to update reaction.",
        );
      });
  }

  function submitComment() {
    const content = commentText.trim();
    if (!content) return;
    setFeedback("");
    setCommentText("");
    watchApi
      .commentOnSermon(sermon.id, content)
      .then((comment) => {
        setCreatedComments((previous) => [...previous, comment]);
        setCommentCount((count) => {
          const nextCount = Number(
            comment.commentsCount ?? comment.commentNumber ?? count + 1,
          );
          onEngagementChange(sermon.id, {
            commentsCount: nextCount,
            commentNumber: nextCount,
          });
          return nextCount;
        });
      })
      .catch((error: unknown) => {
        const status =
          typeof (error as { status?: unknown }).status === "number"
            ? (error as { status: number }).status
            : 0;
        setCommentText(content);
        setFeedback(
          status === 401
            ? "Sign in to comment on sermons."
            : "Unable to post comment.",
        );
      });
  }

  return (
    <dialog
      className="sermon-lightbox"
      aria-label={sermon.title || "Sermon"}
      open
    >
      <button
        type="button"
        className="sermon-lightbox__backdrop"
        onClick={onClose}
        aria-label="Close sermon"
      />
      <div className="sermon-lightbox__panel">
        <div className="sermon-lightbox__top">
          <div>
            <strong>{sermon.title || "Sermon"}</strong>
            <span>
              Source: {sermon.provider} ·{" "}
              {sermon.channelName || "Original platform"}
            </span>
          </div>
          <a href={sermon.sourceUrl} target="_blank" rel="noreferrer">
            View source <ExternalLink size={15} />
          </a>
          <button type="button" onClick={onClose} aria-label="Close sermon">
            <X size={21} />
          </button>
        </div>
        <div className="sermon-lightbox__frame">
          <iframe
            src={sermon.embedUrl}
            title={sermon.title || "Sermon video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-presentation allow-popups"
          />
        </div>
        <div className="sermon-lightbox__engagement">
          <div className="sermon-lightbox__actions">
            <button
              type="button"
              className={liked ? "is-active" : ""}
              onClick={toggleReaction}
            >
              <Heart size={18} fill={liked ? "currentColor" : "none"} />{" "}
              {formatCount(reactionCount)}
            </button>
            <span>
              <MessageCircle size={18} /> {formatCount(commentCount)}
            </span>
          </div>
          {feedback ? (
            <p className="sermon-lightbox__feedback">{feedback}</p>
          ) : null}
          <div className="sermon-comments">
            {comments.length ? (
              comments.map((comment) => (
                <SermonCommentRow
                  key={comment.commentId || comment.id}
                  comment={comment}
                />
              ))
            ) : (
              <p className="sermon-comments__empty">No comments yet.</p>
            )}
          </div>
          <form
            className="sermon-comment-form"
            onSubmit={(event) => {
              event.preventDefault();
              submitComment();
            }}
          >
            <input
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              maxLength={2000}
              placeholder="Add a comment"
              aria-label="Add a sermon comment"
            />
            <button type="submit" aria-label="Post comment">
              <Send size={17} />
            </button>
          </form>
        </div>
      </div>
    </dialog>
  );
}

function SermonCommentRow({ comment }: { comment: SermonComment }) {
  const name =
    comment.userData?.name || comment.userData?.username || "One Body member";
  const created = timeAgo(comment.createdAt ?? comment.created ?? comment.date);
  return (
    <article className="sermon-comment">
      <Avatar
        src={comment.userData?.profileImage || "/brand/avatar1.png"}
        alt={name}
        size={32}
      />
      <div>
        <strong>{name}</strong>
        {created ? <span>{created}</span> : null}
        <p>{comment.content}</p>
      </div>
    </article>
  );
}

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { label: string; value: T }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="sermon-filter-field">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextFilter({
  label,
  value,
  suggestions,
  onChange,
}: {
  label: string;
  value: string;
  suggestions: string[];
  onChange: (value: string) => void;
}) {
  const datalistId = `sermon-filter-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label className="sermon-filter-field">
      <span>{label}</span>
      <input
        value={value}
        list={suggestions.length ? datalistId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {suggestions.length ? (
        <datalist id={datalistId}>
          {suggestions.slice(0, 80).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </datalist>
      ) : null}
    </label>
  );
}

function WatchSkeleton() {
  return (
    <div className="watch-split">
      <section className="watch-col">
        <div
          className="skeleton"
          style={{ width: 80, height: 14, marginBottom: "var(--sp-12)" }}
        />
        <div className="watch-shorts">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{
                width: "100%",
                aspectRatio: "9 / 16",
                borderRadius: "var(--r-base)",
              }}
            />
          ))}
        </div>
      </section>
      <section className="watch-col">
        <div
          className="skeleton"
          style={{ width: 80, height: 14, marginBottom: "var(--sp-12)" }}
        />
        <div className="watch-videos">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{
                width: "100%",
                aspectRatio: "16 / 9",
                borderRadius: "var(--r-base)",
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
