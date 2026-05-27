import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Send } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { chatApi, type ChatConversation, type RawChatMessage } from '@/api/chat';
import { endpoints } from '@/api/endpoints';
import { decrypt, encrypt, parsePlaintext } from '@/chat/crypto';
import { getMyKeypair, getPeerPublicKey } from '@/chat/keyStore';
import { emitWithAck } from '@/chat/socket';
import { useChatConnection } from '@/chat/useChat';
import './Messages.css';

interface ChatMsg {
  id: string;
  clientMessageId?: string;
  fromMe: boolean;
  text: string;
  mediaUrl?: string;
  time: string;
  status?: 'sent' | 'delivered' | 'read';
  pending?: boolean;
  failed?: boolean;
}

interface SendAck {
  ok: boolean;
  error?: string;
  code?: string;
  message?: { _id?: string; status?: ChatMsg['status']; createdAt?: string };
}

function fmtTime(iso?: string): string {
  if (!iso) return 'now';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'now';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function newClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function Conversation() {
  const { id = '' } = useParams();
  const location = useLocation();
  const { socket, connected } = useChatConnection();

  // The list passes the full conversation via router state; on refresh we fall
  // back to treating the route id as a direct peer user id.
  const convo = (location.state as ChatConversation | null) ?? {
    id,
    conversationType: 'direct' as const,
    peerUserId: id,
    name: 'Conversation',
    lastMessagePreview: '',
    updatedAt: '',
    unread: 0,
  };
  const isGroup = convo.conversationType === 'group';
  const peerUserId = convo.peerUserId ?? id;
  const groupId = convo.groupId ?? id;

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const myIdRef = useRef<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // ---- Load + decrypt history ----
  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const me = await endpoints.getMyProfileMapped().catch(() => null);
        if (me?.id) myIdRef.current = me.id;

        let mapped: ChatMsg[] = [];
        if (isGroup) {
          const raw = await chatApi.groupMessages(groupId);
          mapped = raw.map((m) => groupToMsg(m, myIdRef.current));
        } else {
          const [kp, peerPub, raw] = await Promise.all([
            getMyKeypair(),
            getPeerPublicKey(peerUserId),
            chatApi.directMessages(peerUserId),
          ]);
          mapped = await Promise.all(raw.map((m) => directToMsg(m, peerUserId, peerPub, kp.privateKey)));
          if (!peerPub && raw.length) {
            setNotice('This person hasn’t set up secure messaging yet.');
          }
        }
        mapped.sort((a, b) => a.time.localeCompare(b.time));
        if (active) setMessages(mapped);
        chatApi.markConversationRead(peerUserId).catch(() => {});
      } catch {
        if (active) setMessages([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---- Realtime listeners ----
  useEffect(() => {
    if (!socket) return;

    const onDirect = async (payload: RawChatMessage) => {
      if (isGroup || payload.senderId !== peerUserId) return; // only incoming for this DM
      const peerPub = await getPeerPublicKey(peerUserId);
      const kp = await getMyKeypair();
      const msg = await directToMsg(payload, peerUserId, peerPub, kp.privateKey);
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      if (payload._id) socket.emit('chat:message_read', { messageId: payload._id });
    };

    const onGroup = (payload: RawChatMessage) => {
      if (!isGroup || payload.groupId !== groupId) return;
      const msg = groupToMsg(payload, myIdRef.current);
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    };

    const onStatus = (payload: { messageId: string; status: ChatMsg['status'] }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === payload.messageId ? { ...m, status: payload.status } : m)),
      );
    };

    socket.on('chat:new_message', onDirect);
    socket.on('chat:new_group_message', onGroup);
    socket.on('chat:message_status', onStatus);
    return () => {
      socket.off('chat:new_message', onDirect);
      socket.off('chat:new_group_message', onGroup);
      socket.off('chat:message_status', onStatus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, id]);

  // Keep scrolled to newest.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const clientMessageId = newClientId();
    setDraft('');
    setNotice(null);
    setMessages((prev) => [...prev, { id: clientMessageId, clientMessageId, fromMe: true, text, time: 'now', pending: true }]);

    try {
      let ack: SendAck;
      if (isGroup) {
        ack = await emitWithAck<SendAck>('chat:send_group_message', {
          groupId,
          plaintextPayload: text,
          messageType: 'text',
          clientMessageId,
        });
      } else {
        const [kp, peerPub] = await Promise.all([getMyKeypair(), getPeerPublicKey(peerUserId)]);
        if (!peerPub) throw new Error('This person hasn’t set up secure messaging yet.');
        const env = await encrypt(text, kp.privateKey, peerPub);
        ack = await emitWithAck<SendAck>('chat:send_e2ee_message', {
          receiverId: peerUserId,
          encryptedPayload: env.encryptedPayload,
          nonce: env.nonce,
          authTag: env.authTag,
          messageType: 'text',
          senderPublicKeyVersion: 1,
          clientMessageId,
        });
      }

      if (ack?.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMessageId === clientMessageId
              ? { ...m, id: ack.message?._id ?? m.id, pending: false, status: ack.message?.status ?? 'sent' }
              : m,
          ),
        );
      } else {
        markFailed(clientMessageId);
        setNotice(ack?.error ?? 'Message failed to send.');
      }
    } catch (err) {
      markFailed(clientMessageId);
      setNotice(err instanceof Error ? err.message : 'Message failed to send.');
    }
  }

  function markFailed(clientMessageId: string) {
    setMessages((prev) =>
      prev.map((m) => (m.clientMessageId === clientMessageId ? { ...m, pending: false, failed: true } : m)),
    );
  }

  return (
    <div className="thread">
      <header className="thread__head glass">
        <Link to="/messages" className="iconbtn thread__back" aria-label="Back">
          <ArrowLeft size={22} />
        </Link>
        <Avatar src={convo.avatar ?? '/brand/avatar1.png'} alt={convo.name} size={42} />
        <div className="thread__id">
          <strong>{convo.name}</strong>
          <span>
            {isGroup ? 'Group' : connected ? 'Encrypted · online' : 'Encrypted'}
          </span>
        </div>
        <Lock size={16} className="thread__lock" />
      </header>

      <div className="thread__scroll" ref={scrollRef}>
        {loading ? (
          <div className="thread__day">Loading…</div>
        ) : messages.length ? (
          <>
            <div className="thread__day">
              {isGroup ? 'Group chat' : 'End-to-end encrypted'}
            </div>
            {messages.map((m) => (
              <div key={m.id} className={`bubble${m.fromMe ? ' bubble--me' : ''}${m.failed ? ' bubble--failed' : ''}`}>
                {m.mediaUrl ? <img className="bubble__media" src={m.mediaUrl} alt="" /> : null}
                {m.text ? <p>{m.text}</p> : null}
                <span className="bubble__time">
                  {m.pending ? 'sending…' : m.failed ? 'failed' : m.time}
                  {m.fromMe && m.status === 'read' ? ' · read' : ''}
                </span>
              </div>
            ))}
          </>
        ) : (
          <div className="thread__empty">Say hello — messages are end-to-end encrypted.</div>
        )}
      </div>

      {notice ? <div className="thread__notice">{notice}</div> : null}

      <form className="thread__composer" onSubmit={send}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Send a message of encouragement…"
          aria-label="Message"
        />
        <button type="submit" className="thread__send" aria-label="Send" disabled={!draft.trim()}>
          <Send size={19} />
        </button>
      </form>
    </div>
  );
}

/* ---------------- mappers ---------------- */
async function directToMsg(
  m: RawChatMessage,
  peerUserId: string,
  peerPub: string | null,
  myPriv: string,
): Promise<ChatMsg> {
  let text = '🔒 Encrypted message';
  let mediaUrl: string | undefined;
  if (peerPub && m.encryptedPayload && m.nonce) {
    const plain = await decrypt(m.encryptedPayload, m.nonce, peerPub, myPriv);
    if (plain != null) {
      const parsed = parsePlaintext(plain);
      text = parsed.text;
      mediaUrl = parsed.mediaUrl;
    } else {
      text = '🔒 Unable to decrypt';
    }
  }
  return {
    id: String(m._id ?? newClientId()),
    fromMe: m.senderId !== peerUserId,
    text,
    mediaUrl,
    time: fmtTime(m.createdAt),
    status: m.status,
  };
}

function groupToMsg(m: RawChatMessage, myId: string): ChatMsg {
  const parsed = parsePlaintext(m.plaintextPayload ?? '');
  return {
    id: String(m._id ?? newClientId()),
    fromMe: Boolean(myId) && m.senderId === myId,
    text: parsed.text,
    mediaUrl: parsed.mediaUrl,
    time: fmtTime(m.createdAt),
    status: m.status,
  };
}
