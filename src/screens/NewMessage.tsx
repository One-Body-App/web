import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { MessageRecipientSelector } from './MessageRecipientSelector';
import './Messages.css';

export function NewMessage() {
  return (
    <div className="new-message">
      <PageHeader
        title="New message"
        action={
          <Link to="/messages" className="iconbtn" aria-label="Back to messages">
            <ArrowLeft size={22} />
          </Link>
        }
      />

      <MessageRecipientSelector autoFocus />
    </div>
  );
}
