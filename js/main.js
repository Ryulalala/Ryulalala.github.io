import { I18nManager } from './i18n.js';
import { UnderwaterGraph } from './graph.js';

/**
 * アプリケーションの初期化関数
 */
async function initApp() {
  try {
    // 2つのJSONファイルを並列で非同期読み込み
    const [siteTextRes, graphDataRes] = await Promise.all([
      fetch('./data/site-text.json'),
      fetch('./data/graph-data.json')
    ]);

    if (!siteTextRes.ok || !graphDataRes.ok) {
      throw new Error('JSONデータの読み込みに失敗しました。');
    }

    const siteTextData = await siteTextRes.json();
    const graphData = await graphDataRes.json();

    let graphInstance = null;

    // 1. 多言語管理モジュールの起動
    const i18n = new I18nManager(siteTextData, (newLang) => {
      // 言語ボタンが押されたらグラフ側の表示言語も切り替える
      if (graphInstance) {
        graphInstance.setLanguage(newLang);
      }
    });

    // 2. 水中浮遊グラフモジュールの起動
    graphInstance = new UnderwaterGraph(graphData, i18n.getLang());

  } catch (error) {
    console.error('Initialization Error:', error);
  }
}

// DOMの読み込みが完了したらアプリを起動
document.addEventListener('DOMContentLoaded', initApp);
