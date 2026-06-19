import { Share2, Link2, Check } from 'lucide-react';
import { useState } from 'react';

interface ShareButtonsProps {
  title: string;
  url: string;
}

export default function ShareButtons({ title, url }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = encodeURIComponent(url);
  const shareTitle = encodeURIComponent(title);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback silencioso */
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* usuário cancelou */
      }
    } else {
      copyLink();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 font-medium mr-1">Compartilhar</span>
      <button
        type="button"
        onClick={nativeShare}
        className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Compartilhar"
      >
        <Share2 className="w-4 h-4 text-slate-600 dark:text-slate-300" />
      </button>
      <a
        href={`https://wa.me/?text=${shareTitle}%20${shareUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-green-500 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center text-xs font-bold text-green-600"
        aria-label="Compartilhar no WhatsApp"
      >
        WA
      </a>
      <button
        type="button"
        onClick={copyLink}
        className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Copiar link"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-600" />
        ) : (
          <Link2 className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        )}
      </button>
    </div>
  );
}
