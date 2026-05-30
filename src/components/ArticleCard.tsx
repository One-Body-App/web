import { ExternalLink, Newspaper } from 'lucide-react';
import type { OBArticle } from '@/api/endpoints';
import { useFeedTelemetry } from '@/telemetry/feedTelemetry';
import './ArticleCard.css';

/** RSS / news article rendered as an X-style link card. Opens the source link. */
export function ArticleCard({ article }: { article: OBArticle }) {
  const track = useFeedTelemetry();
  return (
    <a
      className="article card"
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track('open_article', 'post_open')}
    >
      {article.image ? (
        <div className="article__media">
          <img src={article.image} alt="" loading="lazy" />
        </div>
      ) : null}
      <div className="article__body">
        <span className="article__source">
          <Newspaper size={13} />
          {article.sourceName}
          {article.time ? ` · ${article.time}` : ''}
        </span>
        <h3 className="article__title">{article.title}</h3>
        {article.summary ? <p className="article__summary">{article.summary}</p> : null}
        <span className="article__cta">
          Read article <ExternalLink size={14} />
        </span>
      </div>
    </a>
  );
}
