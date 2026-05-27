import { ExternalLink } from 'lucide-react';
import { Avatar } from './Avatar';
import type { OBArticle } from '@/api/endpoints';
import './ArticleCard.css';

/** RSS / news article card for the Home "Read" feed. Opens the source link. */
export function ArticleCard({ article }: { article: OBArticle }) {
  return (
    <a
      className="article card"
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
    >
      {article.image ? (
        <div className="article__media">
          <img src={article.image} alt="" loading="lazy" />
        </div>
      ) : null}
      <div className="article__body">
        <div className="article__source">
          <Avatar src={article.sourceAvatar} alt={article.sourceName} size={26} />
          <span className="article__source-name">{article.sourceName}</span>
          {article.time ? <span className="article__time">· {article.time}</span> : null}
        </div>
        <h3 className="article__title">{article.title}</h3>
        {article.summary ? <p className="article__summary">{article.summary}</p> : null}
        <span className="article__cta">
          Read article <ExternalLink size={14} />
        </span>
      </div>
    </a>
  );
}
