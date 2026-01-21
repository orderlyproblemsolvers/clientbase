// plugins/markdown.ts
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
// We load a specific style for the code blocks (e.g., 'nord', 'dracula', 'github-dark')
import 'highlight.js/styles/nord.css' 

export default defineNuxtPlugin(() => {
  const md: any = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: function (str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return '<pre class="hljs"><code>' +
                 hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                 '</code></pre>';
        } catch (__) {}
      }

      return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
    }
  })

  return {
    provide: {
      md: {
        render: (content: string) => md.render(content)
      }
    }
  }
})