import { useCallback, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Send } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { chatApi, type ChatConversation, type RawChatMessage } from '@/api/chat';
import { endpoints } from '@/api/endpoints';
import { decrypt, encrypt, parsePlaintext } from '@/chat/crypto';
import {
  getDeviceKeys,
  getMyKeypair,
  getPeerPublicKey,

} from '@/chat/keyStore';
import { emitWithAck } from '@/chat/socket';
import { useChatConnection } from '@/chat/useChat';
import { ChatVaultGate } from '@/chat/ChatVaultGate';
import type { DeviceKey } from '@/chat/vault';
import { NewMessage } from './NewMessage';
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

  if (id === 'new') {
    return <NewMessage />;
  }

  return <ChatVaultGate><ConversationThread key={id} id={id} /></ChatVaultGate>;
}

function ConversationThread({ id }: { id: string }) {
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const historyCleanupRef = useRef<(() => void) | null>(null);
  const socketCleanupRef = useRef<(() => void) | null>(null);

  // ---- Load + decrypt history ----
  const loadHistoryRef = useCallback((node: HTMLDivElement | null) => {
    historyCleanupRef.current?.();
    historyCleanupRef.current = null;
    if (!node) return;
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
          const [kp, peerPub, raw, historicalKeys] = await Promise.all([
            getMyKeypair(),
            getPeerPublicKey(peerUserId),
            chatApi.directMessages(peerUserId),
            getDeviceKeys(peerUserId, true).catch(() => []),
          ]);
          const ctx: DecryptCtx = {
            myUserId: myIdRef.current,
            keys: [kp, ...kp.retired],
            peerPub,
            peerKeys: historicalKeys.map(k => k.publicKey),
            peerUserId,
          };
          mapped = raw.map((m) => directToMsg(m, ctx));
          if (!peerPub && raw.length) {
            setNotice('This person hasn’t set up secure messaging yet.');
          }
        }
        mapped.sort((a, b) => a.time.localeCompare(b.time));
        if (active) {
          setMessages(mapped);
          scrollToLatest();
        }
        chatApi.markConversationRead(peerUserId).catch(() => {});
      } catch {
        if (active) setMessages([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    historyCleanupRef.current = () => {
      active = false;
    };
  }, [groupId, isGroup, peerUserId]);

  // ---- Realtime listeners ----
  const realtimeRef = useCallback((node: HTMLElement | null) => {
    socketCleanupRef.current?.();
    socketCleanupRef.current = null;
    if (!node) return;
    if (!socket) return;

    const onDirect = async (payload: RawChatMessage) => {
      if (isGroup || payload.senderId !== peerUserId) return; // only incoming for this DM
      const [peerPub, kp] = await Promise.all([getPeerPublicKey(peerUserId), getMyKeypair()]);
      const msg = directToMsg(payload, {
        myUserId: myIdRef.current,
        keys: [kp, ...kp.retired],
        peerPub,
        peerUserId,
      });
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      scrollToLatest();
      if (payload._id) socket.emit('chat:message_read', { messageId: payload._id });
    };

    const onGroup = (payload: RawChatMessage) => {
      if (!isGroup || payload.groupId !== groupId) return;
      const msg = groupToMsg(payload, myIdRef.current);
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      scrollToLatest();
    };

    const onStatus = (payload: { messageId: string; status: ChatMsg['status'] }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === payload.messageId ? { ...m, status: payload.status } : m)),
      );
    };

    socket.on('chat:new_message', onDirect);
    socket.on('chat:new_group_message', onGroup);
    socket.on('chat:message_status', onStatus);
    socketCleanupRef.current = () => {
      socket.off('chat:new_message', onDirect);
      socket.off('chat:new_group_message', onGroup);
      socket.off('chat:message_status', onStatus);
    };
  }, [groupId, isGroup, peerUserId, socket]);

  // Keep scrolled to newest.
  const setScrollNode = useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node;
    node?.scrollTo({ top: node.scrollHeight });
  }, []);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const clientMessageId = newClientId();
    setDraft('');
    setNotice(null);
    setMessages((prev) => [...prev, { id: clientMessageId, clientMessageId, fromMe: true, text, time: 'now', pending: true }]);
    scrollToLatest();

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
        const myUserId = myIdRef.current;
        const [kp, peerPub, peerDevices, myDevices] = await Promise.all([
          getMyKeypair(),
          getPeerPublicKey(peerUserId),
          getDeviceKeys(peerUserId),
          myUserId ? getDeviceKeys(myUserId) : Promise.resolve([]),
        ]);
        const legacyPub = peerPub ?? peerDevices[0]?.publicKey ?? null;
        if (!legacyPub) throw new Error('This person hasn’t set up secure messaging yet.');

        // Legacy single-ciphertext copy to the recipient's primary key. Always
        // sent so older clients keep working.
        const legacy = encrypt(text, kp.privateKey, legacyPub);
        const payload: Record<string, unknown> = {
          receiverId: peerUserId,
          encryptedPayload: legacy.encryptedPayload,
          nonce: legacy.nonce,
          authTag: legacy.authTag,
          messageType: 'text',
          senderPublicKeyVersion: kp.keyVersion,
          senderPublicKey: kp.publicKey,
          clientMessageId,
        };

        // Multi-device fan-out: one envelope per active device key of the
        // recipient AND myself, so every device of both parties can decrypt.
        // Only attached when the server returned device keys — against an older
        // API without the /devices endpoint we degrade to the legacy-only
        // payload above rather than send fields it would reject.
        if (peerDevices.length > 0) {
          const targets: Array<{ userId: string; deviceId: string; keyVersion: number; publicKey: string }> = [];
          const seen = new Set<string>();
          const addTarget = (userId: string, deviceId: string, keyVersion: number, publicKey: string) => {
            const dedupe = `${userId}:${deviceId}`;
            if (!publicKey || seen.has(dedupe)) return;
            seen.add(dedupe);
            targets.push({ userId, deviceId, keyVersion, publicKey });
          };
          peerDevices.forEach((d) => addTarget(peerUserId, d.deviceId, d.keyVersion, d.publicKey));
          if (myUserId) {
            myDevices.forEach((d) => addTarget(myUserId, d.deviceId, d.keyVersion, d.publicKey));
            addTarget(myUserId, kp.deviceId, kp.keyVersion, kp.publicKey);
          }
          payload.senderPublicKey = kp.publicKey;
          payload.recipientEnvelopes = targets.map((t) => {
            const e = encrypt(text, kp.privateKey, t.publicKey);
            return {
              userId: t.userId,
              deviceId: t.deviceId,
              keyVersion: t.keyVersion,
              encryptedPayload: e.encryptedPayload,
              nonce: e.nonce,
            };
          });
        }

        if ((await getMyKeypair()).publicKey !== kp.publicKey) throw new Error('Chat account changed');
        ack = await emitWithAck<SendAck>('chat:send_e2ee_message', payload);
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

  function scrollToLatest() {
    window.requestAnimationFrame(() => {
      const node = scrollRef.current;
      node?.scrollTo({ top: node.scrollHeight });
    });
  }

  return (
    <div className="thread" ref={loadHistoryRef}>
      <header className="thread__head glass" ref={realtimeRef}>
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

      <div className="thread__scroll" ref={setScrollNode}>
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
          <div className="thread__empty">Say hello. Messages are end-to-end encrypted.</div>
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
interface DecryptCtx {
  myUserId: string;
  keys: DeviceKey[];
  peerPub: string | null;
  peerKeys?: string[];
  peerUserId: string;
}

function directToMsg(m: RawChatMessage, ctx: DecryptCtx): ChatMsg {
  let text = '🔒 Encrypted message';
  let mediaUrl: string | undefined;

  let plain: string | null = null;
  let myEnvelope;
  for (const key of ctx.keys) {
    myEnvelope = m.recipientEnvelopes?.find(e => e.userId === ctx.myUserId && e.deviceId === key.deviceId);
    if (myEnvelope && m.senderPublicKey) {
      plain = decrypt(myEnvelope.encryptedPayload, myEnvelope.nonce, m.senderPublicKey, key.privateKey);
    }
    const publicKey = m.senderId !== ctx.myUserId ? m.senderPublicKey ?? ctx.peerPub : ctx.peerPub;
    if (plain === null && publicKey && m.encryptedPayload && m.nonce) {
      for (const candidate of [publicKey, ...(ctx.peerKeys || [])]) {
        plain = decrypt(m.encryptedPayload, m.nonce, candidate, key.privateKey);
        if (plain !== null) break;
      }
    }
    if (plain !== null) break;
  }

  if (plain != null) {
    const parsed = parsePlaintext(plain);
    text = parsed.text;
    mediaUrl = parsed.mediaUrl;
  } else if (myEnvelope || (m.encryptedPayload && m.nonce)) {
    text = '🔒 Unable to decrypt';
  }

  return {
    id: String(m._id ?? newClientId()),
    fromMe: ctx.myUserId ? m.senderId === ctx.myUserId : m.senderId !== ctx.peerUserId,
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
