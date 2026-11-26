/**
 * セクション4：水中浮遊・分裂グラフビュー管理モジュール
 */
export class UnderwaterGraph {
  /**
   * @param {Object} graphData - data/graph-data.json の中身
   * @param { string } initialLang - 初期言語 ('ja' | 'en')
   */
  constructor(graphData, initialLang = 'ja') {
    this.data = graphData;
    this.lang = initialLang;

    // 状態管理 ('OVERVIEW': 大ジャンル一覧 / 'DETAIL': 細かなジャンル表示)
    this.mode = 'OVERVIEW';
    this.activeCategory = null;

    // DOM要素の取得
    this.container = document.getElementById('graph-container');
    this.nodesLayer = document.getElementById('graph-nodes-layer');
    this.activeHeader = document.getElementById('graph-active-header');
    this.categoryTitleEl = document.getElementById('graph-category-title');

    // コンテナのサイズ取得
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;

    // 現在描画中のノード配列・リンク配列
    this.nodes = [];

    // D3 Force Simulation インスタンス
    this.simulation = null;
    this.time = 0;
    this.isVisible = true; // 画面内に表示されているかどうか

    this.initSimulation();
    this.initBackgroundEvents();
    this.initResizeObserver();
    this.initIntersectionObserver();

    // 初期表示（状態1：大ジャンル一覧）を開始
    this.showOverview();
  }

  /**
   * D3の物理演算エンジンの初期化
   */
  initSimulation() {
    this.simulation = d3.forceSimulation()
      .alphaDecay(0) // 0にすることでシミュレーションを停止させず、常時水中浮遊させる
      .velocityDecay(0.3) // 水の抵抗感（数値が大きいほど粘り気のある動きになる）
      .on('tick', () => this.onTick());
  }

  /**
   * 状態1：大まかなジャンル一覧モードを表示
   * @param {Object|null} convergeCenter - 戻る際の中心座標（省略時は画面中央付近）
   */
  showOverview(convergeCenter = null) {
    this.mode = 'OVERVIEW';
    this.activeCategory = null;

    // 左上のカテゴリ名ヘッダーを隠す
    this.activeHeader.classList.replace('opacity-100', 'opacity-0');

    // 大ジャンルのノードデータを生成
    const count = this.data.categories.length;
    this.nodes = this.data.categories.map((cat, index) => {
      // 初期配置を円周上にバランスよく散らす
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
      const radius = Math.min(this.width, this.height) * 0.22;
      return {
        id: cat.id,
        label: cat.label,
        rawCategory: cat,
        type: 'CATEGORY',
        x: convergeCenter ? convergeCenter.x + (Math.random() - 0.5) * 40 : this.width / 2 + Math.cos(angle) * radius,
        y: convergeCenter ? convergeCenter.y + (Math.random() - 0.5) * 40 : this.height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        phase: Math.random() * Math.PI * 2, // 水中浮遊の個別リズム用
        speed: 0.012 + Math.random() * 0.008,
        halfW: 85,
        halfH: 30
      };
    });

    this.renderDOM();
    this.updateForces();
  }

  /**
   * 状態2：選択された大ジャンルが分裂し、細かなジャンルのグラフを表示
   * @param {Object} categoryData - 選択された大ジャンルデータ
   * @param {number} originX - 分裂元のX座標
   * @param {number} originY - 分裂元のY座標
   */
  showDetail(categoryData, originX, originY) {
    this.mode = 'DETAIL';
    this.activeCategory = categoryData;

    // 左上に現在の大ジャンル名を表示
    this.categoryTitleEl.textContent = categoryData.label[this.lang];
    this.activeHeader.classList.replace('opacity-0', 'opacity-100');

    // 細かなジャンルのノードを、分裂元の座標(originX, originY)から生成する
    this.nodes = categoryData.nodes.map((node, idx) => {
      const angle = (idx / categoryData.nodes.length) * Math.PI * 2;
      return {
        id: node.id,
        label: node.label,
        url: node.url,
        type: 'DETAIL',
        // 分裂元座標からほんの少しだけずらして配置し、反発力で一気に広がらせる
        x: originX + Math.cos(angle) * 16,
        y: originY + Math.sin(angle) * 16,
        vx: Math.cos(angle) * 0.8,
        vy: Math.sin(angle) * 0.8,
        phase: Math.random() * Math.PI * 2,
        speed: 0.015 + Math.random() * 0.005,
        halfW: 75,
        halfH: 24
      };
    });

    this.renderDOM();
    this.updateForces();
  }

  /**
   * SVGの線とHTMLの四角ノードをDOMに生成・バインドする
   */
  renderDOM() {
    // 1. HTMLの四角（ノード）の描画
    this.nodesLayer.innerHTML = '';

    this.nodes.forEach((nodeData) => {
      const el = document.createElement('div');
      nodeData.el = el;

      // モードとリンク有無に応じたスタイルクラスの設定
      if (nodeData.type === 'CATEGORY') {
        el.className = 'graph-node node-category px-6 py-3.5 rounded-xl font-semibold text-base sm:text-lg text-slate-100 cursor-pointer select-none whitespace-nowrap';
      } else {
        const hasLink = Boolean(nodeData.url);
        const borderClass = hasLink ? 'node-detail-link cursor-pointer' : 'node-detail-nolink cursor-grab';
        el.className = `graph-node ${borderClass} px-4 py-2 rounded-lg text-xs sm:text-sm font-medium text-slate-100 select-none whitespace-nowrap flex items-center gap-1.5`;
      }

      // ラベルテキストの設定
      this.updateNodeLabelElement(nodeData);

      // 初期スケールを小さくしてポップイン（分裂）演出
      el.style.opacity = '0';
      this.nodesLayer.appendChild(el);

      // 要素の実際の幅・高さを計測して物理演算の境界判定用に保存
      const rect = el.getBoundingClientRect();
      nodeData.halfW = (rect.width || 120) / 2;
      nodeData.halfH = (rect.height || 44) / 2;

      // フェードイン表示
      requestAnimationFrame(() => {
        el.style.transition = 'opacity 0.35s ease, box-shadow 0.25s ease, border-color 0.25s ease';
        el.style.opacity = '1';
      });

      // ドラッグ＆クリック（タップ）イベントの設定
      this.attachNodeInteractions(el, nodeData);
    });
  }

  /**
   * ノード内のテキストと外部リンクアイコンを更新する
   */
  updateNodeLabelElement(nodeData) {
    const el = nodeData.el;
    if (!el) return;

    el.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = nodeData.label[this.lang];
    el.appendChild(span);

    // リンクありの細かなジャンルには小さな矢印マークを添える
    if (nodeData.type === 'DETAIL' && nodeData.url) {
      const icon = document.createElement('span');
      icon.className = 'text-sky-400 text-xs opacity-80';
      icon.textContent = '↗';
      el.appendChild(icon);
    }
  }

  /**
   * 各ノードに対するドラッグ操作およびダブルクリック／シングルタップ判定の設定
   */
  attachNodeInteractions(el, nodeData) {
    let startX = 0;
    let startY = 0;
    let isDragged = false;
    let lastPointerType = 'mouse';
    nodeData.isHovered = false;

    // ポインターの種類（mouse か touch か）を記録
    el.addEventListener('pointerdown', (e) => {
      lastPointerType = e.pointerType;
    });

    //マウスが乗ったら停止
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') {
        nodeData.isHovered = true;
        nodeData.fx = nodeData.x;
        nodeData.fy = nodeData.y;
        nodeData.vx = 0;
        nodeData.vy = 0;
      }
    })

    //マウスが離れたら固定を解除
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') {
        nodeData.isHovered = false;
        nodeData.fx = null;
        nodeData.fy = null;
      }
    })

    // D3ドラッグの設定
    const dragBehavior = d3.drag()
      .on('start', (event) => {
        startX = event.x;
        startY = event.y;
        isDragged = false;
        nodeData.fx = nodeData.x;
        nodeData.fy = nodeData.y;
      })
      .on('drag', (event) => {
        const dx = event.x - startX;
        const dy = event.y - startY;
        // 5px以上動いたら「ドラッグ移動」とみなす（タップとの誤判定防止）
        if (Math.hypot(dx, dy) > 5) {
          isDragged = true;
        }
        nodeData.fx = Math.max(nodeData.halfW, Math.min(this.width - nodeData.halfW, event.x));
        nodeData.fy = Math.max(nodeData.halfH, Math.min(this.height - nodeData.halfH, event.y));
      })
      .on('end', () => {
        // ドラッグ終了時に固定を解除し、再び水中を漂わせる
        if (nodeData.isHovered){
          nodeData.fx = nodeData.x;
          nodeData.fy = nodeData.y;
          nodeData.vx = 0;
          nodeData.vy = 0;
        } else {
          nodeData.fx = null;
          nodeData.fy = null;
        }
        
        // スマホ・タブレット（touch）で、ドラッグせずに指を離した場合は「シングルタップ」として処理
        if (!isDragged) {
          if (nodeData.type === 'DETAIL' && nodeData.url) {
            this.handleNodeActivate(nodeData);
          }
          else if (lastPointerType === 'touch') {
          this.handleNodeActivate(nodeData);
          }
        }
        
      });

    d3.select(el).call(dragBehavior);

    // PC（マウス）用のダブルクリックイベント
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation(); // 背景のダブルクリックイベントが発火するのを防ぐ
      if (lastPointerType !== 'touch') {
        this.handleNodeActivate(nodeData);
      }
    });
  }

  /**
   * ノードが実行（PCダブルクリック / スマホシングルタップ）されたときの処理
   */
  handleNodeActivate(nodeData) {
    if (this.mode === 'OVERVIEW' && nodeData.type === 'CATEGORY') {
      // 大ジャンル → 細かなジャンルへ分裂遷移
      this.showDetail(nodeData.rawCategory, nodeData.x, nodeData.y);
    } else if (this.mode === 'DETAIL' && nodeData.type === 'DETAIL') {
      // 細かなジャンルでURLが設定されていれば別タブで開く
      if (nodeData.url) {
        window.open(nodeData.url, '_blank', 'noopener,noreferrer');
      }
    }
  }

  /**
   * 背景エリアのダブルクリック（PC）およびシングルタップ（スマホ）で一覧へ戻る処理
   */
  initBackgroundEvents() {
    // PC用：背景ダブルクリックで状態1へ戻る
    this.container.addEventListener('dblclick', (e) => {
      // ノードの上ではなく背景がクリックされた場合のみ
      if (this.mode === 'DETAIL' && (e.target === this.container || e.target === this.nodesLayer)) {
        this.showOverview({ x: this.width / 2, y: this.height / 2 });
      }
    });

    // スマホ・タブレット用：背景シングルタップで状態1へ戻る
    let bgTouchStartX = 0;
    let bgTouchStartY = 0;
    this.container.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && (e.target === this.container || e.target === this.nodesLayer)) {
        bgTouchStartX = e.clientX;
        bgTouchStartY = e.clientY;
      }
    });

    this.container.addEventListener('pointerup', (e) => {
      if (
        this.mode === 'DETAIL' &&
        e.pointerType === 'touch' &&
        (e.target === this.container || e.target === this.nodesLayer)
      ) {
        const dist = Math.hypot(e.clientX - bgTouchStartX, e.clientY - bgTouchStartY);
        if (dist < 10) {
          this.showOverview({ x: this.width / 2, y: this.height / 2 });
        }
      }
    });
  }

  /**
   * モードに応じて物理演算の力（反発力・バネ・中心引力）を再設定する
   */
  updateForces() {
    this.simulation.nodes(this.nodes);

    if (this.mode === 'OVERVIEW') {
      // 大ジャンル一覧モード：ゆったりと互いに距離を保つ
      this.simulation
        .force('charge', d3.forceManyBody().strength(-400))
        .force('collide', d3.forceCollide().radius((d) => Math.max(d.halfW, d.halfH) + 30).iterations(2))
        .force('x', d3.forceX(this.width / 2).strength(0.03))
        .force('y', d3.forceY(this.height / 2).strength(0.03));
    } else {
      // 詳細モード：関連線で結びつつバランスよく広がる
      this.simulation
        .force('charge', d3.forceManyBody().strength(-250))
        .force('collide',
          d3.forceCollide()
            .radius((d) => d.halfW * 0.65 + d.halfH * 0.35 + 18)
            .iterations(2))
        .force('x', d3.forceX(this.width / 2).strength(0.03))
        .force('y', d3.forceY(this.height / 2).strength(0.03));
    }

    this.simulation.alpha(0.8).restart();
  }

  /**
   * 毎フレーム呼ばれる更新処理（水中浮遊の揺らぎ計算＋壁の跳ね返り＋座標反映）
   */
  onTick() {
    if (!this.isVisible) return;
    this.time += 1;

    const padX = 16;
    const padTop = this.mode === 'DETAIL' ? 85 : 20; // 詳細モード時は左上ヘッダーと重ならないよう余白を広げる
    const padBottom = 45;

    this.nodes.forEach((d) => {
      // 1. 水中を漂うような微弱な周期的フォース（サイン・コサイン波）を加える
      if (d.isHovered) {
        d.vx = 0;
        d.vy = 0;
        return
      }
      const waveAngle = this.time * d.speed + d.phase;
      d.vx += Math.cos(waveAngle) * 0.10;
      d.vy += Math.sin(waveAngle * 0.9) * 0.9;

      // 2. コンテナの枠外へはみ出さないよう境界で柔らかく押し戻す
      const minX = d.halfW + padX;
      const maxX = this.width - d.halfW - padX;
      const minY = d.halfH + padTop;
      const maxY = this.height - d.halfH - padBottom;

      if (d.x < minX) {
        d.x = minX;
        d.vx = Math.abs(d.vx) * 0.5;
      } else if (d.x > maxX) {
        d.x = maxX;
        d.vx = -Math.abs(d.vx) * 0.5;
      }

      if (d.y < minY) {
        d.y = minY;
        d.vy = Math.abs(d.vy) * 0.5;
      } else if (d.y > maxY) {
        d.y = maxY;
        d.vy = -Math.abs(d.vy) * 0.5;
      }

      // 3. HTML要素の位置を更新
      if (d.el) {
        d.el.style.transform = `translate3d(${d.x}px, ${d.y}px, 0) translate(-50%, -50%)`;
      }
    });
  }

  /**
   * 言語が切り替わったときにグラフ内のテキストとヘッダーを更新する
   * @param {string} newLang - 'ja' | 'en'
   */
  setLanguage(newLang) {
    this.lang = newLang;

    if (this.mode === 'DETAIL' && this.activeCategory) {
      this.categoryTitleEl.textContent = this.activeCategory.label[this.lang];
    }

    this.nodes.forEach((nodeData) => {
      this.updateNodeLabelElement(nodeData);
      if (nodeData.el) {
        const rect = nodeData.el.getBoundingClientRect();
        nodeData.halfW = (rect.width || 120) / 2;
        nodeData.halfH = (rect.height || 44) / 2;
      }
    });
  }

  /**
   * ウィンドウサイズ変更時にグラフ領域のサイズを再計算する
   */
  initResizeObserver() {
    window.addEventListener('resize', () => {
      this.width = this.container.clientWidth;
      this.height = this.container.clientHeight;
      this.updateForces();
    });
  }

  /**
   * パフォーマンス最適化：グラフが画面外にスクロールしている間は計算を一時停止する
   */
  initIntersectionObserver() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          this.isVisible = entry.isIntersecting;
        });
      },
      { threshold: 0.05 }
    );

    observer.observe(this.container);
  }
}
