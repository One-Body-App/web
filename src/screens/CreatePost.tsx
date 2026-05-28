import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ComposerMediaTray, type ComposerMediaItem } from '@/components/ComposerMediaTray';
import './CreatePost.css';

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
  const [audience, setAudience] = useState<AudienceKey>('everyone');
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [media, setMedia] = useState<ComposerMediaItem[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  const audienceRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // When quoting, an empty body is still a valid (plain) repost.
  const trimmed = text.trim();
  const overLimit = text.length > MAX_LEN;
  const hasMedia = media.length > 0;
  const canPost = !publishing && !overLimit && (Boolean(quote) || hasMedia || trimmed.length > 0);
  const dirty = trimmed.length > 0 || hasMedia;

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
        await endpoints.repost(quote.sourceId, quote.sourceType, trimmed || undefined);
      } else if (hasMedia) {
        await endpoints.createPostWithMedia({
          content: trimmed,
          images: media.filter((item) => item.kind === 'photo').map((item) => item.file),
        });
      } else {
        await endpoints.createPost(trimmed);
      }
    } catch {
      // Best-effort in dev (offline/CORS); still return to the feed.
    }
    navigate('/home', { replace: true });
  }, [canPost, hasMedia, media, navigate, quote, trimmed]);

  // Esc to close, Cmd/Ctrl+Enter to publish — standard composer ergonomics.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        publish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, publish]);

  // Close the audience popover when clicking anywhere outside its trigger.
  useEffect(() => {
    if (!audienceOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!audienceRef.current?.contains(e.target as Node)) setAudienceOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [audienceOpen]);

  // Autosize the textarea — feels native on desktop where mobile keyboards
  // aren't pushing the layout around.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 168)}px`;
  }, [text]);

  // Focus on mount once paint settles, so the entry animation isn't interrupted.
  useEffect(() => {
    const t = window.setTimeout(() => textareaRef.current?.focus(), 220);
    return () => window.clearTimeout(t);
  }, []);

  // Lock background scroll while the modal is open so the feed behind doesn't
  // sneak around when the user touchpads. Restores whatever value was there.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const activeAudience = useMemo(
    () => AUDIENCES.find((a) => a.key === audience) ?? AUDIENCES[0],
    [audience],
  );
  const AudienceIcon = activeAudience.Icon;

  // Counter ring geometry — a single ~22px SVG that fills as text grows.
  const ringR = 9;
  const ringC = 2 * Math.PI * ringR;
  const fill = Math.min(1, text.length / MAX_LEN);
  const ringOffset = ringC * (1 - fill);
  const counterTone = overLimit ? 'is-over' : fill >= WARN_AT ? 'is-warn' : '';

  return (
    <dialog className="compose-stage" aria-label="Create a post" open>
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
            <h1>{quote ? 'Quote post' : 'What is God doing?'}</h1>
          </div>

          <div className="compose__post-wrap">
            <button
              type="button"
              className={`compose__preview-toggle${previewOpen ? ' is-on' : ''}`}
              onClick={() => setPreviewOpen((value) => !value)}
              aria-label={previewOpen ? 'Hide preview' : 'Show preview'}
              aria-pressed={previewOpen}
            >
              {previewOpen ? <EyeOff size={16} strokeWidth={2.25} /> : <Eye size={16} strokeWidth={2.25} />}
            </button>
            <CounterRing
              tone={counterTone}
              circumference={ringC}
              offset={ringOffset}
              radius={ringR}
              shown={text.length > 0}
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
                <button
                  type="button"
                  className={`compose__audience${audienceOpen ? ' is-open' : ''}`}
                  onClick={() => setAudienceOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={audienceOpen ? 'true' : 'false'}
                >
                  <AudienceIcon size={13} strokeWidth={2.25} />
                  <span>{activeAudience.label}</span>
                  <ChevronDown size={13} strokeWidth={2.25} className="compose__audience-caret" />
                </button>

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
            </div>
          </div>

          <textarea
            ref={textareaRef}
            className="compose__input"
            aria-label={quote ? 'Quote post text' : 'Post text'}
            placeholder={
              quote
                ? 'Add your thoughts…'
                : 'Share a testimony, a verse, a prayer request, or what God is doing…'
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            maxLength={MAX_LEN + 60 /* allow brief overshoot so the warning ring can show */}
          />

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
            />
          ) : null}
        </AnimatePresence>

        <input
          ref={photoInputRef}
          type="file"
          multiple
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length === 0) return;
            setMedia((current) => {
              const next = [...current];
              for (const file of files) {
                if (next.length >= 10) break;
                next.push({
                  id: `mi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
                  kind: 'photo',
                  file,
                  previewUrl: URL.createObjectURL(file),
                });
              }
              return next;
            });
            // Reset so the same files can be picked again if needed.
            if (photoInputRef.current) photoInputRef.current.value = '';
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
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
              withoutVideo.push({
                id: `mi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
                kind: 'video',
                file,
                previewUrl: URL.createObjectURL(file),
              });
              return withoutVideo;
            });
            if (videoInputRef.current) videoInputRef.current.value = '';
          }}
        />

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
            <button type="button" className="compose__tool" aria-label="Add verse">
              <BookOpen size={20} strokeWidth={2} />
              <span>Verse</span>
            </button>
            <button type="button" className="compose__tool" aria-label="Add feeling">
              <Smile size={20} strokeWidth={2} />
              <span>Feeling</span>
            </button>
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
            <div className="compose-preview__avatar-fallback" aria-hidden />
          )}
          <div className="compose-preview__author">
            <strong>{authorName}</strong>
            <span>{audienceLabel}</span>
          </div>
        </header>

        {text ? <p className="compose-preview__body">{text}</p> : null}

        {hero ? (
          <div className={`compose-preview__hero${hero.kind === 'video' ? ' is-video' : ''}`}>
            {hero.kind === 'video' ? (
              <>
                <video src={hero.previewUrl} muted playsInline />
                <span className="compose-preview__play" aria-hidden>
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
                  <video src={item.previewUrl} muted playsInline />
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
