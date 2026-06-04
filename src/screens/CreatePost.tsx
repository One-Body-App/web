import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ChevronDown,
  Eye,
  EyeOff,
  Film,
  Globe,
  Heart,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  Play,
  Repeat2,
  Smile,
  Users,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/auth/context';
import { endpoints, type SocialContentType } from '@/api/endpoints';
import { FEELING_ITEMS, getFeelingItem } from '@/api/feelings';
import { ComposerMediaTray } from '@/components/ComposerMediaTray';
import { buildComposerMediaItem, type ComposerMediaItem } from '@/components/composerMedia';
import { TurnstileGate } from '@/components/TurnstileGate';
import { ScripturePickerDrawer } from '@/components/scripture/ScripturePickerDrawer';
import { ScriptureQuoteCard } from '@/components/scripture/ScriptureQuoteCard';
import { hasLikelyScripture, type ScriptureShare } from '@/api/scripture';
import '@/components/scripture/scripture.css';
import './CreatePost.css';

// Standalone Turnstile only enforces when a site key is configured. In
// preview mode (key absent) we let posts through so the dev UX still works.
const TURNSTILE_ENABLED = Boolean(
  (import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY ?? '').trim()
);

// Mirrors MAX_CONTENT_LENGHT in the mobile NewPost screen — keep parity so the
// API never sees a body that one client allows and the other doesn't.
const MAX_LEN = 300;
// Past this fill ratio the counter ring turns into a warning color; this matches
// the visual cue mobile users get when they're nearing the limit.
const WARN_AT = 0.8;

const AUDIENCES = [
  { key: 'everyone', label: 'Everyone', hint: 'Anyone on One Body can see this.', Icon: Globe },
  { key: 'connections', label: 'Connections', hint: 'Only people you connect with.', Icon: Users },
] as const;
type AudienceKey = (typeof AUDIENCES)[number]['key'];

/** Passed via router state when reposting-with-quote from a post's action bar. */
interface QuoteDraft {
  sourceId: string;
  sourceType: SocialContentType;
  author: string;
  username: string;
  avatar: string;
  verified?: boolean;
  body?: string;
  image?: string;
}

export function CreatePost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const routerState = location.state as
    | { quote?: QuoteDraft; backgroundLocation?: unknown }
    | null;
  const quote = routerState?.quote;
  // `backgroundLocation` is set by AppShell/PostCard when opening the composer
  // from inside the app. Its presence tells us there's a meaningful history
  // entry to pop back to; deep-links land without it and must redirect to /home.
  const hasBackground = Boolean(routerState?.backgroundLocation);

  const [text, setText] = useState('');
  // Scripture detection chip: debounced, dismissable. Surfaces when the draft
  // looks like it contains a verse reference (e.g. "John 3:16"). The server
  // does the authoritative parse on submit — this is just a live affordance.
  const [scriptureDismissedFor, setScriptureDismissedFor] = useState('');
  const [audience, setAudience] = useState<AudienceKey>('everyone');
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [feeling, setFeeling] = useState<string | null>(null);
  const [feelingOpen, setFeelingOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [media, setMedia] = useState<ComposerMediaItem[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [versePickerOpen, setVersePickerOpen] = useState(false);
  const [selectedScripture, setSelectedScripture] = useState<ScriptureShare | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const audienceRef = useRef<HTMLDivElement | null>(null);
  const feelingRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dialogCleanupRef = useRef<(() => void) | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // When quoting, an empty body is still a valid (plain) repost.
  const trimmed = text.trim();

  // A selected feeling is folded into the post body on publish (the API has no
  // dedicated feeling field), so it must count toward the character budget too.
  const activeFeeling = getFeelingItem(feeling);
  const feelingPrefix = activeFeeling ? `— feeling ${activeFeeling.label} ${activeFeeling.emoji}` : '';
  const composedContent = [feelingPrefix, trimmed].filter(Boolean).join('\n\n');
  // +2 approximates the blank line that joins the feeling prefix to the body.
  const feelingLen = feelingPrefix ? feelingPrefix.length + 2 : 0;
  const totalLen = text.length + feelingLen;
  const overLimit = totalLen > MAX_LEN;

  const scriptureDetected = hasLikelyScripture(text);
  const showScriptureChip = !selectedScripture && scriptureDetected && scriptureDismissedFor !== text;
  const hasMedia = media.length > 0;
  const scripturePayload = useMemo(
    () =>
      selectedScripture
        ? {
            book: selectedScripture.book,
            chapter: selectedScripture.chapter,
            verse: selectedScripture.verse,
            verseEnd: selectedScripture.verseEnd,
            translation: selectedScripture.translation,
          }
        : undefined,
    [selectedScripture],
  );
  const turnstilePassed = !TURNSTILE_ENABLED || Boolean(turnstileToken);
  const canPost =
    !publishing &&
    !overLimit &&
    turnstilePassed &&
    (Boolean(quote) || hasMedia || trimmed.length > 0 || Boolean(feeling) || Boolean(selectedScripture));
  const dirty = trimmed.length > 0 || hasMedia || Boolean(feeling) || Boolean(selectedScripture);

  const close = useCallback(() => {
    if (dirty && !window.confirm('Discard this post?')) return;
    if (hasBackground) {
      navigate(-1);
    } else {
      navigate('/home', { replace: true });
    }
  }, [dirty, hasBackground, navigate]);

  const publish = useCallback(async () => {
    if (!canPost) return;
    setPublishing(true);
    try {
      if (quote) {
        await endpoints.repost(quote.sourceId, quote.sourceType, composedContent || undefined);
      } else if (hasMedia) {
        await endpoints.createPostWithMedia({
          content: composedContent,
          images: media.filter((item) => item.kind === 'photo').map((item) => item.file),
          turnstileToken: turnstileToken ?? undefined,
          scriptureShare: scripturePayload,
        });
      } else {
        await endpoints.createPost(composedContent, {
          turnstileToken: turnstileToken ?? undefined,
          scriptureShare: scripturePayload,
        });
      }
    } catch {
      // Best-effort in dev (offline/CORS); still return to the feed.
    }
    navigate('/home', { replace: true });
  }, [canPost, composedContent, hasMedia, media, navigate, quote, scripturePayload, turnstileToken]);

  const resizeTextarea = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 168)}px`;
  }, []);

  const setTextareaNode = useCallback((node: HTMLTextAreaElement | null) => {
    textareaRef.current = node;
    if (node) resizeTextarea(node);
  }, [resizeTextarea]);

  const setDialogNode = useCallback((node: HTMLDialogElement | null) => {
    dialogCleanupRef.current?.();
    dialogCleanupRef.current = null;
    if (!node) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => textareaRef.current?.focus(), 220);
    dialogCleanupRef.current = () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previous;
    };
  }, []);

  const focusTextarea = useCallback((cursor?: number) => {
    const node = textareaRef.current;
    if (!node) return;
    window.requestAnimationFrame(() => {
      node.focus();
      if (typeof cursor === 'number') {
        node.setSelectionRange(cursor, cursor);
      }
      resizeTextarea(node);
    });
  }, [resizeTextarea]);

  const handleSelectScripture = useCallback((share: ScriptureShare) => {
    // The scripture rides along as its own quote card (selectedScripture), not
    // as text in the caption. Attach it, close the picker, refocus the caption.
    setSelectedScripture(share);
    setVersePickerOpen(false);
    focusTextarea();
  }, [focusTextarea]);

  const handleDialogKeyDown = useCallback((event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void publish();
    }
  }, [close, publish]);

  const handleDialogPointerDown = useCallback((event: PointerEvent<HTMLDialogElement>) => {
    const target = event.target as Node;
    if (audienceOpen && !audienceRef.current?.contains(target)) {
      setAudienceOpen(false);
    }
    if (feelingOpen && !feelingRef.current?.contains(target)) {
      setFeelingOpen(false);
    }
  }, [audienceOpen, feelingOpen]);

  const activeAudience = useMemo(
    () => AUDIENCES.find((a) => a.key === audience) ?? AUDIENCES[0],
    [audience],
  );
  const AudienceIcon = activeAudience.Icon;

  // Counter ring geometry — a single ~22px SVG that fills as text grows.
  const ringR = 9;
  const ringC = 2 * Math.PI * ringR;
  const fill = Math.min(1, totalLen / MAX_LEN);
  const ringOffset = ringC * (1 - fill);
  const counterTone = overLimit ? 'is-over' : fill >= WARN_AT ? 'is-warn' : '';

  return (
    <dialog
      className="compose-stage"
      aria-label="Create a post"
      open
      ref={setDialogNode}
      onKeyDownCapture={handleDialogKeyDown}
      onPointerDownCapture={handleDialogPointerDown}
    >
      {/* Atmospheric backdrop: brand mesh + a soft cyan halo behind the card. */}
      <div className="compose-stage__backdrop" aria-hidden="true" />
      <button
        type="button"
        className="compose-stage__scrim"
        onClick={close}
        aria-label="Close composer"
      />

      <section className="compose">
        {/* 1px aqua → sapphire gradient hairline at the top of the card. */}
        <span className="compose__ribbon" aria-hidden="true" />

        <header className="compose__head">
          <button
            type="button"
            className="compose__close"
            onClick={close}
            aria-label="Cancel"
          >
            <X size={20} strokeWidth={2.25} />
          </button>

          <div className="compose__title">
            <span className="compose__eyebrow">{quote ? 'Sharing forward' : 'New post'}</span>
            <h1>{quote ? 'Quote post' : "What's on your heart?"}</h1>
          </div>

          <div className="compose__post-wrap">
            {previewOpen ? (
              <button
                type="button"
                className="compose__preview-toggle is-on"
                onClick={() => setPreviewOpen((value) => !value)}
                aria-label="Hide preview"
                aria-pressed="true"
              >
                <EyeOff size={16} strokeWidth={2.25} />
              </button>
            ) : (
              <button
                type="button"
                className="compose__preview-toggle"
                onClick={() => setPreviewOpen((value) => !value)}
                aria-label="Show preview"
                aria-pressed="false"
              >
                <Eye size={16} strokeWidth={2.25} />
              </button>
            )}
            <CounterRing
              tone={counterTone}
              circumference={ringC}
              offset={ringOffset}
              radius={ringR}
              shown={totalLen > 0}
            />
            <button
              type="button"
              className="btn btn--brand compose__post"
              disabled={!canPost}
              onClick={publish}
            >
              {publishing ? (quote ? 'Reposting…' : 'Posting…') : quote ? 'Repost' : 'Post'}
            </button>
          </div>
        </header>

        <div className="compose__body">
          <div className="compose__author">
            {user ? <Avatar src={user.imageUrl} alt={user.fullName} size={44} /> : null}
            <div className="compose__author-meta">
              <strong>{user?.fullName}</strong>
              <div className="compose__audience-wrap" ref={audienceRef}>
                {audienceOpen ? (
                  <button
                    type="button"
                    className="compose__audience is-open"
                    onClick={() => setAudienceOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded="true"
                  >
                    <AudienceIcon size={13} strokeWidth={2.25} />
                    <span>{activeAudience.label}</span>
                    <ChevronDown size={13} strokeWidth={2.25} className="compose__audience-caret" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="compose__audience"
                    onClick={() => setAudienceOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded="false"
                  >
                    <AudienceIcon size={13} strokeWidth={2.25} />
                    <span>{activeAudience.label}</span>
                    <ChevronDown size={13} strokeWidth={2.25} className="compose__audience-caret" />
                  </button>
                )}

                {audienceOpen ? (
                  <div className="compose__audience-menu glass" role="menu">
                    {AUDIENCES.map(({ key, label, hint, Icon }) => (
                      <button
                        key={key}
                        type="button"
                        role="menuitemradio"
                        aria-checked={audience === key ? 'true' : 'false'}
                        className={`compose__audience-opt${
                          audience === key ? ' is-active' : ''
                        }`}
                        onClick={() => {
                          setAudience(key);
                          setAudienceOpen(false);
                        }}
                      >
                        <Icon size={16} strokeWidth={2} />
                        <span className="compose__audience-opt-text">
                          <strong>{label}</strong>
                          <small>{hint}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {activeFeeling ? (
                <span className="compose__feeling-chip">
                  <img src={activeFeeling.iconUrl} alt="" aria-hidden="true" />
                  <span>is feeling {activeFeeling.label}</span>
                  <button
                    type="button"
                    className="compose__feeling-chip-clear"
                    onClick={() => setFeeling(null)}
                    aria-label="Clear feeling"
                  >
                    <X size={13} strokeWidth={2.5} />
                  </button>
                </span>
              ) : null}
            </div>
          </div>

          <textarea
            ref={setTextareaNode}
            className="compose__input"
            aria-label={quote ? 'Quote post text' : 'Post text'}
            placeholder={
              quote
                ? 'Add your thoughts…'
                : 'Share a testimony, a verse, a prayer request, or what God is doing…'
            }
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              resizeTextarea(e.currentTarget);
            }}
            rows={1}
            maxLength={MAX_LEN + 60 /* allow brief overshoot so the warning ring can show */}
          />

          {/* Scripture detection chip — spell-check / "rewrite with AI" style. */}
          {showScriptureChip ? (
            <div className="compose__scripture-chip-row">
              <button
                type="button"
                className="scripture-chip"
                onClick={() => {
                  // Lookahead/autocomplete is a stubbed future feature; for now
                  // tapping the chip just returns focus to the draft.
                  textareaRef.current?.focus();
                }}
                title="Scripture reference detected — it'll become a tappable link"
              >
                <BookOpen size={13} strokeWidth={2.4} />
                Scripture detected
              </button>
              <button
                type="button"
                className="scripture-chip__dismiss"
                aria-label="Dismiss"
                onClick={() => setScriptureDismissedFor(text)}
              >
                ×
              </button>
            </div>
          ) : null}

          {selectedScripture ? (
            <ScriptureQuoteCard
              share={selectedScripture}
              onRemove={() => setSelectedScripture(null)}
            />
          ) : null}

          {quote ? (
            <article className="compose__quote">
              <header className="compose__quote-head">
                <Avatar src={quote.avatar} alt={quote.author} size={28} verified={quote.verified} />
                <span className="compose__quote-name">{quote.author}</span>
                <span className="compose__quote-user">@{quote.username}</span>
                <Repeat2 size={15} className="compose__quote-icon" />
              </header>
              {quote.body ? <p className="compose__quote-body">{quote.body}</p> : null}
              {quote.image ? (
                <div className="compose__quote-media">
                  <img src={quote.image} alt="" loading="lazy" />
                </div>
              ) : null}
            </article>
          ) : null}
        </div>

        <ComposerMediaTray items={media} onChange={setMedia} maxItems={10} />

        <AnimatePresence initial={false}>
          {previewOpen ? (
            <ComposePreview
              key="preview"
              text={text}
              media={media}
              authorName={user?.fullName ?? 'You'}
              authorAvatar={user?.imageUrl}
              audienceLabel={activeAudience.label}
              feelingLabel={activeFeeling?.label}
              feelingIconUrl={activeFeeling?.iconUrl}
              scriptureShare={selectedScripture}
            />
          ) : null}
        </AnimatePresence>

        <input
          ref={photoInputRef}
          className="compose__file-input"
          type="file"
          multiple
          accept="image/*"
          aria-label="Add photos"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length === 0) return;
            setMedia((current) => {
              const next = [...current];
              for (const file of files) {
                if (next.length >= 10) break;
                next.push(buildComposerMediaItem(file));
              }
              return next;
            });
            // Reset so the same files can be picked again if needed.
            if (photoInputRef.current) photoInputRef.current.value = '';
          }}
        />
        <input
          ref={videoInputRef}
          className="compose__file-input"
          type="file"
          accept="video/*"
          aria-label="Add video"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setMedia((current) => {
              const next = [...current];
              // For now: only one video per post. Replace any existing video.
              const withoutVideo = next.filter((item) => item.kind !== 'video');
              if (withoutVideo.length >= 10) {
                return current;
              }
              withoutVideo.push(buildComposerMediaItem(file));
              return withoutVideo;
            });
            if (videoInputRef.current) videoInputRef.current.value = '';
          }}
        />

        {TURNSTILE_ENABLED ? (
          <div className="compose__turnstile">
            <TurnstileGate
              action="social-post-publish"
              size="flexible"
              onVerify={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken(null)}
              onError={() => setTurnstileToken(null)}
            />
          </div>
        ) : null}

        <footer className="compose__toolbar">
          <div className="compose__tools">
            <button
              type="button"
              className="compose__tool"
              aria-label="Add photo"
              onClick={() => photoInputRef.current?.click()}
            >
              <ImageIcon size={20} strokeWidth={2} />
              <span>Photo</span>
            </button>
            <button
              type="button"
              className="compose__tool"
              aria-label="Add video"
              onClick={() => videoInputRef.current?.click()}
            >
              <Film size={20} strokeWidth={2} />
              <span>Video</span>
            </button>
            {versePickerOpen ? (
              <button
                type="button"
                className={`compose__tool${selectedScripture ? ' is-on' : ''}`}
                aria-label="Add verse"
                aria-expanded="true"
                onClick={() => setVersePickerOpen((value) => !value)}
              >
                <BookOpen size={20} strokeWidth={2} />
                <span>Verse</span>
              </button>
            ) : (
              <button
                type="button"
                className={`compose__tool${selectedScripture ? ' is-on' : ''}`}
                aria-label="Add verse"
                aria-expanded="false"
                onClick={() => setVersePickerOpen((value) => !value)}
              >
                <BookOpen size={20} strokeWidth={2} />
                <span>Verse</span>
              </button>
            )}
            <div className="compose__feeling-wrap" ref={feelingRef}>
              {feelingOpen ? (
                <button
                  type="button"
                  className={`compose__tool${activeFeeling ? ' is-on' : ''}`}
                  aria-label="Add feeling"
                  aria-haspopup="menu"
                  aria-expanded="true"
                  onClick={() => setFeelingOpen((value) => !value)}
                >
                  <Smile size={20} strokeWidth={2} />
                  <span>Feeling</span>
                </button>
              ) : (
                <button
                  type="button"
                  className={`compose__tool${activeFeeling ? ' is-on' : ''}`}
                  aria-label="Add feeling"
                  aria-haspopup="menu"
                  aria-expanded="false"
                  onClick={() => setFeelingOpen((value) => !value)}
                >
                  <Smile size={20} strokeWidth={2} />
                  <span>Feeling</span>
                </button>
              )}
              {feelingOpen ? (
                <div className="compose__feeling-menu glass" role="menu">
                  {FEELING_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={feeling === item.id ? 'true' : 'false'}
                      className={`compose__feeling-opt${feeling === item.id ? ' is-active' : ''}`}
                      onClick={() => {
                        setFeeling((prev) => (prev === item.id ? null : item.id));
                        setFeelingOpen(false);
                      }}
                    >
                      <img src={item.iconUrl} alt="" aria-hidden="true" />
                      <small>{item.label}</small>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button type="button" className="compose__tool" aria-label="Add location">
              <MapPin size={20} strokeWidth={2} />
              <span>Place</span>
            </button>
          </div>
          <span className="compose__hint" aria-hidden="true">
            <kbd>⌘</kbd>
            <kbd>↵</kbd>
            <span>to post</span>
          </span>
        </footer>

        <ScripturePickerDrawer
          open={versePickerOpen}
          selected={selectedScripture}
          onSelect={handleSelectScripture}
          onClear={() => setSelectedScripture(null)}
        />
      </section>
    </dialog>
  );
}

interface CounterRingProps {
  tone: string;
  circumference: number;
  offset: number;
  radius: number;
  shown: boolean;
}

/** Subtle progress ring that fills as the body approaches the 300-char limit. */
function CounterRing({ tone, circumference, offset, radius, shown }: CounterRingProps) {
  if (!shown) return null;
  return (
    <svg
      className={`compose__counter ${tone}`}
      width={22}
      height={22}
      viewBox="0 0 22 22"
      aria-hidden="true"
    >
      <circle cx={11} cy={11} r={radius} className="compose__counter-track" />
      <circle
        cx={11}
        cy={11}
        r={radius}
        className="compose__counter-fill"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 11 11)"
      />
    </svg>
  );
}

interface ComposePreviewProps {
  text: string;
  media: ComposerMediaItem[];
  authorName: string;
  authorAvatar?: string;
  audienceLabel: string;
  feelingLabel?: string;
  feelingIconUrl?: string;
  scriptureShare?: ScriptureShare | null;
}

/**
 * Live "how this looks in feed" preview. Renders inline below the editor so the
 * author can sanity-check formatting without leaving the composer.
 */
function ComposePreview({
  text,
  media,
  authorName,
  authorAvatar,
  audienceLabel,
  feelingLabel,
  feelingIconUrl,
  scriptureShare,
}: ComposePreviewProps) {
  const heroVideo = media.find((item) => item.kind === 'video');
  const hero = heroVideo ?? media[0];
  const extras = media.filter((item) => item.id !== hero?.id);

  return (
    <motion.aside
      className="compose-preview"
      initial={{ opacity: 0, y: 8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: 8, height: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      aria-label="Post preview"
    >
      <header className="compose-preview__head">
        <span className="compose-preview__eyebrow">Preview</span>
        <span className="compose-preview__hint">How this looks in the feed</span>
      </header>

      <article className="compose-preview__card">
        <header className="compose-preview__card-head">
          {authorAvatar ? (
            <Avatar src={authorAvatar} alt={authorName} size={36} />
          ) : (
            <div className="compose-preview__avatar-fallback" aria-hidden="true" />
          )}
          <div className="compose-preview__author">
            <strong>
              {authorName}
              {feelingLabel ? (
                <span className="compose-preview__feeling">
                  {' '}
                  is feeling {feelingLabel}
                  {feelingIconUrl ? (
                    <img src={feelingIconUrl} alt="" aria-hidden="true" />
                  ) : null}
                </span>
              ) : null}
            </strong>
            <span>{audienceLabel}</span>
          </div>
        </header>

        {text ? <p className="compose-preview__body">{text}</p> : null}

        {scriptureShare ? <ScriptureQuoteCard share={scriptureShare} /> : null}

        {hero ? (
          <div className={`compose-preview__hero${hero.kind === 'video' ? ' is-video' : ''}`}>
            {hero.kind === 'video' ? (
              <>
                <video src={hero.previewUrl} muted playsInline aria-label="Post video preview" />
                <span className="compose-preview__play" aria-hidden="true">
                  <Play size={26} fill="currentColor" />
                </span>
              </>
            ) : (
              <img src={hero.previewUrl} alt="" />
            )}
          </div>
        ) : null}

        {extras.length > 0 ? (
          <div className="compose-preview__strip">
            {extras.slice(0, 4).map((item) => (
              <div key={item.id} className="compose-preview__strip-item">
                {item.kind === 'video' ? (
                  <video src={item.previewUrl} muted playsInline aria-label="Additional video preview" />
                ) : (
                  <img src={item.previewUrl} alt="" />
                )}
              </div>
            ))}
            {extras.length > 4 ? (
              <div className="compose-preview__strip-item is-more">+{extras.length - 4}</div>
            ) : null}
          </div>
        ) : null}

        <footer className="compose-preview__stats">
          <span>
            <Heart size={15} /> 0
          </span>
          <span>
            <MessageCircle size={15} /> 0
          </span>
        </footer>
      </article>
    </motion.aside>
  );
}
