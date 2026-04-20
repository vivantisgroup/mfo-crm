import { Node, mergeAttributes } from '@tiptap/core';

export interface IframeOptions {
  allowFullscreen: boolean;
  HTMLAttributes: Record<string, any>;
  allowedDomains: string[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    iframe: {
      /**
       * Add an iframe
       */
      setIframe: (options: { src: string }) => ReturnType;
    };
  }
}

export const Iframe = Node.create<IframeOptions>({
  name: 'iframe',

  group: 'block',

  atom: true,

  addOptions() {
    return {
      allowFullscreen: true,
      allowedDomains: [
        'youtube.com',
        'www.youtube.com',
        'vimeo.com',
        'player.vimeo.com',
        'app.powerbi.com',
        'lookerstudio.google.com',
        'datastudio.google.com',
        'metabase.com',
        'tableau.com',
        'public.tableau.com'
      ],
      HTMLAttributes: {
        class: 'iframe-wrapper',
        style: 'width: 100%; min-height: 400px; border-radius: 8px; border: 1px solid var(--border-subtle); background: var(--bg-surface);',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'iframe',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return {};
          const src = (dom as HTMLElement).getAttribute('src');
          if (!src) return false;
          
          try {
            const url = new URL(src);
            // Allow if domain is in whitelist, or if we want to be strict, reject if not.
            // But we must access this.options.allowedDomains which is not available in getAttrs directly like this.
            // We'll validate it in renderHTML instead.
          } catch {
            return false;
          }
          return {};
        }
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    let validSrc = false;
    try {
      if (HTMLAttributes.src) {
        const urlObj = new URL(HTMLAttributes.src);
        validSrc = this.options.allowedDomains.includes(urlObj.hostname);
      }
    } catch {
      validSrc = false;
    }

    if (!validSrc) {
      // Return a safe placeholder if domain is not whitelisted
      return ['div', { class: 'text-red-500 text-sm p-4 border border-red-200 bg-red-50 rounded-md' }, `[Blocked Iframe: Domain not whitelisted]`];
    }

    return [
      'iframe',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        frameborder: '0',
        allowfullscreen: this.options.allowFullscreen ? 'true' : 'false',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
      }),
    ];
  },

  addAttributes() {
    return {
      src: {
        default: null,
      },
    };
  },

  addCommands() {
    return {
      setIframe:
        (options: { src: string }) =>
        ({ tr, dispatch }) => {
          const { selection } = tr;
          
          let isValid = false;
          try {
            const urlObj = new URL(options.src);
            isValid = this.options.allowedDomains.includes(urlObj.hostname);
          } catch {
             // Let it fail in renderHTML as well, or we reject here
             isValid = false;
          }

          if (!isValid) {
             console.warn("Blocked Iframe from untrusted domain:", options.src);
             // Optionally you could dispatch an error or toast here
          }
          
          const node = this.type.create(options);

          if (dispatch) {
            tr.replaceRangeWith(selection.from, selection.to, node);
          }

          return true;
        },
    };
  },
});
