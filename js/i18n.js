/**
 * 多言語（日本語 / 英語）切り替え管理モジュール
 */
export class I18nManager {
  /**
   * @param {Object} siteTextData - data/site-text.json の中身
   * @param {Function} onLangChangeCallback - 言語変更時にグラフ側へ通知する関数
   */
  constructor(siteTextData, onLangChangeCallback) {
    this.data = siteTextData;
    this.currentLang = 'ja'; // 初期言語は日本語
    this.onLangChangeCallback = onLangChangeCallback;

    // タッチ端末かどうかの簡易判定（操作説明テキストの出し分け用）
    this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    this.initEventListeners();
    this.renderAll();
  }

  /**
   * 現在の言語コード ('ja' または 'en') を返す
   */
  getLang() {
    return this.currentLang;
  }

  /**
   * 言語切り替えボタンのクリックイベント登録
   */
  initEventListeners() {
    const toggleBtn = document.getElementById('lang-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.currentLang = this.currentLang === 'ja' ? 'en' : 'ja';
        document.documentElement.lang = this.currentLang;
        this.renderAll();

        // グラフモジュール側にも言語が変わったことを知らせてラベルを更新させる
        if (typeof this.onLangChangeCallback === 'function') {
          this.onLangChangeCallback(this.currentLang);
        }
      });
    }
  }

  /**
   * 画面内のテキストを現在の言語で一括更新する
   */
  renderAll() {
    const lang = this.currentLang;

    // 1. ページタイトル・ヘッダー
    document.title = this.data.siteTitle[lang];
    this.setText('site-title', this.data.siteTitle[lang]);
    this.setText('site-subtitle', this.data.siteSubtitle[lang]);

    // 2. ボタンのハイライト切り替え (JP / EN)
    const indJa = document.getElementById('lang-ind-ja');
    const indEn = document.getElementById('lang-ind-en');
    if (indJa && indEn) {
      indJa.className = lang === 'ja' ? 'font-bold text-sky-400' : 'text-slate-400';
      indEn.className = lang === 'en' ? 'font-bold text-sky-400' : 'text-slate-400';
    }

    // 3. セクション1: 学んでいる言語
    this.setText('sec-lang-title', this.data.sections.languages.title[lang]);
    const langListEl = document.getElementById('sec-lang-list');
    if (langListEl) {
      langListEl.innerHTML = '';
      this.data.sections.languages.items.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'px-3.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-sm text-slate-200 shadow-sm';
        li.textContent = item[lang];
        langListEl.appendChild(li);
      });
    }

    // 4. セクション2: 好きな本
    this.setText('sec-book-title', this.data.sections.books.title[lang]);
    const bookListEl = document.getElementById('sec-book-list');
    if (bookListEl) {
      bookListEl.innerHTML = '';
      this.data.sections.books.items.forEach((item) => {
        const li = document.createElement('li');

        if (item.url) {
          li.className = 'group inline-flex items-center gap-1.5 cursor-pointer select-none';
          li.title = this.isTouchDevice
            ? (lang === 'ja' ? 'タップでAmazonを開く' : 'Tap to open on Amazon')
            : (lang === 'ja' ? 'ダブルクリックでAmazonを開く' : 'Double-click to open on Amazon');

          // 青色のリンクテキストのみを表示
          const titleSpan = document.createElement('span');
          titleSpan.className = 'text-sky-400 underline decoration-sky-400/60 underline-offset-4 group-hover:text-sky-300 group-hover:decoration-sky-300 transition-colors';
          titleSpan.textContent = item[lang];

          // 外部リンクアイコン（SVG）
          const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          iconSvg.setAttribute('viewBox', '0 0 20 20');
          iconSvg.setAttribute('fill', 'currentColor');
          iconSvg.setAttribute('class', 'w-4 h-4 text-sky-400 group-hover:text-sky-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform');
          iconSvg.innerHTML = '<path fill-rule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clip-rule="evenodd" /><path fill-rule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clip-rule="evenodd" />';

          li.appendChild(titleSpan);
          li.appendChild(iconSvg);

          const eventType = this.isTouchDevice ? 'click' : 'dblclick';
          li.addEventListener(eventType, () => {
            window.open(item.url, '_blank', 'noopener,noreferrer');
          });
        } else {
          li.textContent = item[lang];
        }

        bookListEl.appendChild(li);
      });
    }

    // 5. セクション3: 好きな言葉（見出しのみ更新、引用本文は英語のまま）
    this.setText('sec-quote-title', this.data.sections.quotes.title[lang]);

    // 6. セクション4: グラフの見出しと操作説明
    this.setText('sec-graph-title', this.data.sections.graph.title[lang]);
    const instructionText = this.isTouchDevice
      ? this.data.sections.graph.instructionTouch[lang]
      : this.data.sections.graph.instructionPc[lang];
    this.setText('graph-instruction', instructionText);
    this.setText('graph-back-hint', this.data.sections.graph.backHint[lang]);
  }

  /**
   * 指定IDの要素のテキストを書き換えるヘルパーメソッド
   */
  setText(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = text;
    }
  }
}
