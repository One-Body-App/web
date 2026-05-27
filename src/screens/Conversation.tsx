import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, Send, Video } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { conversations, sampleThread, type ChatMessage } from '@/data/mock';
import './Messages.css';

export function Conversation() {
  const { id } = useParams();
  const convo = conversations.find((c) => c.id === id) ?? conversations[0];
  const [messages, setMessages] = useState<ChatMessage[]>(sampleThread);
  const [draft, setDraft] = useState('');

  function send(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [
      ...m,
      { id: `m${m.length + 1}`, fromMe: true, text, time: 'now' },
    ]);
    setDraft('');
  }

  return (
    <div className="thread">
      <header className="thread__head glass">
        <Link to="/messages" className="iconbtn thread__back" aria-label="Back">
          <ArrowLeft size={22} />
        </Link>
        <Avatar src={convo.user.avatar} alt={convo.user.name} size={42} verified={convo.user.verified} />
        <div className="thread__id">
          <strong>{convo.user.name}</strong>
          <span>@{convo.user.username}</span>
        </div>
        <div className="thread__head-actions">
          <button className="iconbtn" aria-label="Voice call">
            <Phone size={19} />
          </button>
          <button className="iconbtn" aria-label="Video call">
            <Video size={19} />
          </button>
        </div>
      </header>

      <div className="thread__scroll">
        <div className="thread__day">Today</div>
        {messages.map((m) => (
          <div key={m.id} className={`bubble${m.fromMe ? ' bubble--me' : ''}`}>
            <p>{m.text}</p>
            <span className="bubble__time">{m.time}</span>
          </div>
        ))}
      </div>

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
