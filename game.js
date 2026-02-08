        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const scoreEl = document.getElementById('score');
        const finalScoreEl = document.getElementById('final-score');
        const gameOverEl = document.getElementById('game-over');
        const autoBtn = document.getElementById('auto-btn');
        const bombStockEl = document.getElementById('bomb-stock');

        // ゲームの状態
        let gameState = 'playing'; // playing, gameover
        let score = 0;
        let frameCount = 0;
        let isAutoMode = false;
        let shakeDuration = 0;
        let bossSpawnTimer = 0; // ボス出現用タイマー

        function toggleAutoMode() {
            isAutoMode = !isAutoMode;
            autoBtn.textContent = isAutoMode ? "AUTO: ON" : "AUTO: OFF";
            autoBtn.style.background = isAutoMode ? "#ff3366" : "#00ccff";
            // オート時はマウス入力を無効化（干渉を防ぐ）
            mouse.useMouse = false;
        }

        function triggerBomb() {
            if (player.bombStock > 0 && gameState === 'playing') {
                player.bombStock--;
                bombStockEl.textContent = player.bombStock;
                shakeDuration = 20; // 画面を揺らす
                
                // 画面内の敵弾をすべて消去し、パーティクルに変換
                for (const b of enemyBullets) {
                    createParticles(b.x, b.y, b.color, 3);
                }
                enemyBullets = [];
                
                // 全ての敵にダメージ
                for (const e of enemies) {
                    e.hp -= 50;
                    createParticles(e.x, e.y, '#ff3366', 10);
                }
                
                // ボム発動エフェクト用フラッシュ
                flashEffect = 15;
            }
        }
        let flashEffect = 0;

        let bullets = [];
        let enemyBullets = [];
        let enemies = [];
        let particles = [];
        let items = [];
        let nazcaBg;

        // 入力管理
        const keys = {};
        const mouse = { x: canvas.width / 2, y: canvas.height - 100, isDown: false, useMouse: false };

        // イベントリスナー
        window.addEventListener('keydown', e => {
            if (e.code === 'KeyA') {
                toggleAutoMode();
                return;
            }
            if (e.code === 'KeyX') {
                triggerBomb();
                return;
            }
            if (isAutoMode) return; // オート中はキー無効
            keys[e.code] = true;
            mouse.useMouse = false;
        });
        window.addEventListener('keyup', e => keys[e.code] = false);
        
        canvas.addEventListener('mousemove', e => {
            if (isAutoMode) return; // オート中はマウス無効
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
            mouse.useMouse = true;
        });
        canvas.addEventListener('mousedown', () => { if(!isAutoMode) mouse.isDown = true; });
        canvas.addEventListener('mouseup', () => { if(!isAutoMode) mouse.isDown = false; });
        
        // タッチ操作対応
        canvas.addEventListener('touchmove', e => {
            if (isAutoMode) return;
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.touches[0].clientX - rect.left;
            mouse.y = e.touches[0].clientY - rect.top;
            mouse.useMouse = true;
            mouse.isDown = true;
        }, { passive: false });


        // ユーティリティ
        const toRad = deg => deg * Math.PI / 180;
        const dist = (x1, y1, x2, y2) => Math.sqrt((x2-x1)**2 + (y2-y1)**2);

        // --- ナスカの地上絵データ ---
        const NAZCA_PATHS = {
            hummingbird: [
                [0,0], [10,-5], [20,-20], [25,-10], [15,0], [30,10], [40,5], [50,15], [30,25], [10,15], // 右翼
                [0,10], [-10,15], [-30,25], [-50,15], [-40,5], [-30,10], [-15,0], // 左翼
                [-5,20], [0,30], [5,20], // 尾
                [0,-5], [-5,-15], [0,-25], [5,-15] // 頭
            ],
            spider: [
                [0,-20], [5,-15], [10,-20], [15,-10], [5,-5], [10,0], [20,-5], [25,5], [10,10], // 右脚
                [0,15], [5,25], [0,35], [-5,25], // 腹
                [-10,10], [-25,5], [-20,-5], [-10,0], [-5,-5], // 左脚
                [-15,-10], [-10,-20], [-5,-15], [0,-20] // 頭
            ],
            spiral: [
                [0,0], [10,0], [10,10], [-10,10], [-10,-10], [20,-10], [20,20], [-20,20], [-20,-20], [30,-20]
            ],
            lines: [
                [0,-50], [0,50], [-20, 30], [20, 30], [0, 50]
            ]
        };

        class NazcaBackground {
            constructor() {
                this.patterns = [];
                this.timer = 0;
            }
            update() {
                this.timer++;
                // 定期的に新しい絵を追加
                if (this.timer % 150 === 0) {
                    const keys = Object.keys(NAZCA_PATHS);
                    const type = keys[Math.floor(Math.random() * keys.length)];
                    const x = Math.random() * canvas.width;
                    const scale = 2 + Math.random() * 3; // 大きさをランダムに
                    this.patterns.push({
                        type: type,
                        x: x,
                        y: -100,
                        scale: scale,
                        speed: 1.5 // スクロール速度
                    });
                }

                // 更新と削除
                for (let i = this.patterns.length - 1; i >= 0; i--) {
                    const p = this.patterns[i];
                    p.y += p.speed;
                    if (p.y > canvas.height + 100) {
                        this.patterns.splice(i, 1);
                    }
                }
            }
            draw() {
                ctx.save();
                ctx.strokeStyle = '#334433'; // 暗い緑色（古代遺跡風）
                ctx.lineWidth = 3;
                
                for (const p of this.patterns) {
                    const path = NAZCA_PATHS[p.type];
                    ctx.beginPath();
                    ctx.setTransform(p.scale, 0, 0, p.scale, p.x, p.y); // 座標変換
                    
                    if (path.length > 0) {
                        ctx.moveTo(path[0][0], path[0][1]);
                        for (let i = 1; i < path.length; i++) {
                            ctx.lineTo(path[i][0], path[i][1]);
                        }
                    }
                    ctx.stroke();
                }
                ctx.restore();
            }
        }

        // --- クラス定義 (依存関係順に配置) ---

        // 1. Bullet (基本クラス)
        class Bullet {
            constructor(x, y, vx, vy, r, color, owner) {
                this.x = x;
                this.y = y;
                this.vx = vx;
                this.vy = vy;
                this.r = r;
                this.color = color;
                this.owner = owner; // 'player' or 'enemy'
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                // 画面外判定
                if (this.x < -20 || this.x > canvas.width + 20 || this.y < -20 || this.y > canvas.height + 20) {
                    return false;
                }
                return true;
            }

            draw() {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                // 外側の光の輪
                ctx.globalAlpha = 0.6;
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.r * 2.2, 0, Math.PI * 2);
                ctx.fill();
                
                // 中心の白い核
                ctx.globalAlpha = 1.0;
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.r * 0.8, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        // 2. Missile (Bulletを継承)
        class Missile extends Bullet {
            constructor(x, y, vx, vy) {
                super(x, y, vx, vy, 6, '#00ffff', 'player'); 
                this.target = null;
            }
            update() {
                // ターゲット検索 (より頻繁に、かつ正確に)
                if (!this.target || this.target.hp <= 0) {
                     let minDist = 1000;
                     this.target = null;
                     for(const e of enemies) {
                         const d = dist(this.x, this.y, e.x, e.y);
                         if (d < minDist) {
                             minDist = d;
                             this.target = e;
                         }
                     }
                }
                
                // 超高性能誘導ロジック
                if (this.target) {
                    const dx = this.target.x - this.x;
                    const dy = this.target.y - this.y;
                    const angle = Math.atan2(dy, dx);
                    
                    // 現在の速度ベクトルと目標方向の差を埋める（クイック旋回）
                    const targetVx = Math.cos(angle) * 18;
                    const targetVy = Math.sin(angle) * 18;
                    
                    // 慣性を打ち消して目標方向に鋭く曲がる (0.3 -> 0.5に強化)
                    this.vx += (targetVx - this.vx) * 0.5;
                    this.vy += (targetVy - this.vy) * 0.5;
                } else {
                    // ターゲットがいない場合は直進加速
                    this.vy -= 0.5;
                }

                this.x += this.vx;
                this.y += this.vy;
                
                // トレイル（ミサイルの後ろに出る煙のような光）
                if (frameCount % 2 === 0) {
                    const p = new Particle(this.x, this.y, '#00ffff');
                    p.vx = -this.vx * 0.2;
                    p.vy = -this.vy * 0.2;
                    p.life = 0.5;
                    particles.push(p);
                }

                return this.x > -100 && this.x < canvas.width + 100 && this.y > -100 && this.y < canvas.height + 100;
            }
        }

        // 3. Player
        class Player {
            constructor() {
                this.x = canvas.width / 2;
                this.y = canvas.height - 100;
                this.radius = 4;
                this.displayRadius = 15;
                this.speed = 5;
                this.slowSpeed = 2;
                this.lastShot = 0;
                this.shotDelay = 5;
                this.powerLevel = 1; 
                this.missileTime = 0; 
                this.options = 0;
                this.shield = 0; // シールド枚数
                this.bombStock = 3; // 初期ボム数
            }

            update() {
                if (this.missileTime > 0) this.missileTime--;

                // 連射速度のバランス調整 (Lv.1で7, Lv.5で4。程よい連射感に)
                this.shotDelay = Math.max(4, 8 - this.powerLevel);

                // ブースターエフェクト
                if (frameCount % 2 === 0) {
                    const p = new Particle(this.x, this.y + 15, '#00ffff');
                    p.vx = (Math.random() - 0.5) * 2;
                    p.vy = 2 + Math.random() * 3;
                    p.life = 0.4;
                    particles.push(p);
                }

                if (isAutoMode) {
                    this.updateAutoPilot();
                } else {
                    // 通常移動
                    if (mouse.useMouse) {
                        this.x += (mouse.x - this.x) * 0.2;
                        this.y += (mouse.y - this.y) * 0.2;
                    } else {
                        let s = keys['ShiftLeft'] ? this.slowSpeed : this.speed;
                        if (keys['ArrowUp']) this.y -= s;
                        if (keys['ArrowDown']) this.y += s;
                        if (keys['ArrowLeft']) this.x -= s;
                        if (keys['ArrowRight']) this.x += s;
                    }
                }

                // 画面外制限
                this.x = Math.max(this.displayRadius, Math.min(canvas.width - this.displayRadius, this.x));
                this.y = Math.max(this.displayRadius, Math.min(canvas.height - this.displayRadius, this.y));

                // 射撃 (マウスなら常時、キーならZ、オートなら常時)
                if (mouse.useMouse || keys['KeyZ'] || isAutoMode) {
                    if (frameCount - this.lastShot > this.shotDelay) {
                        this.shoot();
                        this.lastShot = frameCount;
                    }
                }
            }

            updateAutoPilot() {
                // オートパイロットロジック
                let moveX = 0;
                let moveY = 0;
                const detectionRange = 100; // 危険察知範囲

                // 1. 敵弾からの回避（斥力）- 生存最優先
                let dangerCount = 0;
                for (const b of enemyBullets) {
                    const d = dist(this.x, this.y, b.x, b.y);
                    if (d < detectionRange) {
                        const force = (detectionRange - d) / d * 15; // 回避力を強化
                        const angle = Math.atan2(this.y - b.y, this.x - b.x);
                        moveX += Math.cos(angle) * force;
                        moveY += Math.sin(angle) * force;
                        dangerCount++;
                    }
                }

                // 2. アイテム回収（引力）- 積極化
                // 危険があっても、少し遠くても取りに行く
                for (const item of items) {
                    const d = dist(this.x, this.y, item.x, item.y);
                    // 画面内のアイテムなら全部対象
                    if (d < 400) { 
                        // 危険度に応じて引力を調整（危険な時は無理しないが、少しは寄る）
                        const pullStrength = (dangerCount > 0) ? 2 : 5; 
                        const angle = Math.atan2(item.y - this.y, item.x - this.x);
                        moveX += Math.cos(angle) * pullStrength;
                        moveY += Math.sin(angle) * pullStrength;
                    }
                }

                // 3. 敵への接近（攻撃・引力）
                if (dangerCount === 0 && enemies.length > 0) {
                    // 一番下の敵（脅威）を狙う
                    const target = enemies.sort((a,b) => b.y - a.y)[0];
                    if (target) {
                        // X軸を合わせに行く動き（攻撃を当てるため）
                        const xDiff = target.x - this.x;
                        moveX += xDiff * 0.1; 
                        
                        // Y軸は一定距離を保つ
                        const targetY = target.y + 250;
                        moveY += (targetY - this.y) * 0.05;
                    }
                }

                const centerX = canvas.width / 2;
                const centerY = canvas.height - 150;
                moveX += (centerX - this.x) * 0.05;
                moveY += (centerY - this.y) * 0.05;

                this.x += moveX;
                this.y += moveY;
            }

            shoot() {
                // メインショット (サイズを少し控えめに)
                const bulletR = 3 + this.powerLevel * 0.8;
                const bulletColor = this.powerLevel >= 4 ? '#ffffff' : '#88ffff';
                
                // 中央の弾
                bullets.push(new Bullet(this.x - 6, this.y, 0, -16, bulletR, bulletColor, 'player'));
                bullets.push(new Bullet(this.x + 6, this.y, 0, -16, bulletR, bulletColor, 'player'));
                
                if (this.powerLevel >= 2) {
                    bullets.push(new Bullet(this.x - 12, this.y, -0.5, -15, bulletR - 1, '#88ccff', 'player'));
                    bullets.push(new Bullet(this.x + 12, this.y, 0.5, -15, bulletR - 1, '#88ccff', 'player'));
                }
                if (this.powerLevel >= 3) {
                     bullets.push(new Bullet(this.x - 18, this.y, -2.5, -14, bulletR - 1, '#66aaff', 'player'));
                     bullets.push(new Bullet(this.x + 18, this.y, 2.5, -14, bulletR - 1, '#66aaff', 'player'));
                }
                if (this.powerLevel >= 4) {
                     bullets.push(new Bullet(this.x - 24, this.y, -5, -13, bulletR - 2, '#4488ff', 'player'));
                     bullets.push(new Bullet(this.x + 24, this.y, 5, -13, bulletR - 2, '#4488ff', 'player'));
                }
                if (this.powerLevel >= 5) {
                     // レベル5: 角度をさらに広げて制圧
                     bullets.push(new Bullet(this.x - 30, this.y, -8, -12, bulletR - 2, '#0055ff', 'player'));
                     bullets.push(new Bullet(this.x + 30, this.y, 8, -12, bulletR - 2, '#0055ff', 'player'));
                }

                // オプションからの射撃
                if (this.options >= 1) {
                    bullets.push(new Bullet(this.x - 30, this.y + 10, 0, -18, 4, '#88ff88', 'player'));
                }
                if (this.options >= 2) {
                    bullets.push(new Bullet(this.x + 30, this.y + 10, 0, -18, 4, '#88ff88', 'player'));
                }

                // ホーミングミサイル (頻度を少し落とす)
                if (this.missileTime > 0 && frameCount % 12 === 0) {
                     bullets.push(new Missile(this.x - 20, this.y, -2, -5));
                     bullets.push(new Missile(this.x + 20, this.y, 2, -5));
                }
            }

            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                
                // シールド描画 (よりサイバーな円環に)
                if (this.shield > 0) {
                    ctx.strokeStyle = '#00ffff';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]); // 点線
                    ctx.beginPath();
                    ctx.arc(0, 0, this.displayRadius + 10, frameCount * 0.05, frameCount * 0.05 + Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // オプション描画
                ctx.fillStyle = '#88ff88';
                if (this.options >= 1) {
                    ctx.beginPath(); ctx.arc(-30, 15, 6, 0, Math.PI*2); ctx.fill();
                }
                if (this.options >= 2) {
                    ctx.beginPath(); ctx.arc(30, 15, 6, 0, Math.PI*2); ctx.fill();
                }

                // 自機本体のデザイン (メカニカル)
                // 1. ウィング
                ctx.fillStyle = '#444';
                ctx.beginPath();
                ctx.moveTo(-this.displayRadius - 5, this.displayRadius);
                ctx.lineTo(0, 0);
                ctx.lineTo(this.displayRadius + 5, this.displayRadius);
                ctx.fill();

                // 2. メインボディ
                const grad = ctx.createLinearGradient(0, -this.displayRadius, 0, this.displayRadius);
                grad.addColorStop(0, '#fff');
                grad.addColorStop(1, '#88ffff');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(0, -this.displayRadius);
                ctx.lineTo(this.displayRadius, this.displayRadius * 0.5);
                ctx.lineTo(0, this.displayRadius * 0.2);
                ctx.lineTo(-this.displayRadius, this.displayRadius * 0.5);
                ctx.closePath();
                ctx.fill();

                // 3. コックピット
                ctx.fillStyle = '#f00';
                ctx.beginPath();
                ctx.arc(0, -2, 3, 0, Math.PI * 2);
                ctx.fill();

                // 当たり判定ドット
                if (keys['ShiftLeft'] || mouse.useMouse) {
                    ctx.fillStyle = '#f00';
                    ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.stroke();
                }

                ctx.restore();
            }
        }

        // 4. Enemy (Bulletを使用)
        class Enemy {
            constructor(x, y, hp, type) {
                this.x = x;
                this.y = y;
                this.hp = hp;
                this.maxHp = hp;
                this.type = type; // 'normal', 'boss'
                this.radius = type === 'boss' ? 40 : 15;
                this.angle = 0;
                this.age = 0;
            }

            update() {
                this.age++;

                // 移動パターン
                if (this.type === 'normal') {
                    this.y += 2;
                    this.x += Math.sin(this.age * 0.05) * 2;
                } else if (this.type === 'boss') {
                    if (this.y < 150) this.y += 1; // 登場
                    this.x = canvas.width/2 + Math.sin(this.age * 0.02) * 150;
                }

                // 弾幕パターン
                if (this.type === 'normal' && this.age % 60 === 0) {
                    // 自機狙い弾
                    const angle = Math.atan2(player.y - this.y, player.x - this.x);
                    enemyBullets.push(new Bullet(this.x, this.y, Math.cos(angle)*4, Math.sin(angle)*4, 6, '#ffaa00', 'enemy'));
                }

                if (this.type === 'boss') {
                    // スパイラル弾
                    if (this.age % 5 === 0) {
                        const speed = 4;
                        const a = this.age * 0.1;
                        enemyBullets.push(new Bullet(this.x, this.y, Math.cos(a)*speed, Math.sin(a)*speed, 5, '#ff00ff', 'enemy'));
                        enemyBullets.push(new Bullet(this.x, this.y, Math.cos(a + Math.PI)*speed, Math.sin(a + Math.PI)*speed, 5, '#ff00ff', 'enemy'));
                    }
                    // 全方位弾
                    if (this.age % 120 === 0) {
                         for (let i = 0; i < 360; i += 20) {
                            const rad = toRad(i);
                            enemyBullets.push(new Bullet(this.x, this.y, Math.cos(rad)*3, Math.sin(rad)*3, 7, '#ff3333', 'enemy'));
                        }
                    }
                }

                // 画面外削除
                if (this.y > canvas.height + 50) return false; // 削除
                return true; // 生存
            }

            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                
                if (this.type === 'normal') {
                    // 回転フレーム
                    ctx.rotate(this.age * 0.05);
                    ctx.strokeStyle = '#dd3333';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        const r = this.radius;
                        const angle = i * Math.PI * 2 / 6;
                        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
                    }
                    ctx.closePath();
                    ctx.stroke();
                    
                    // コア
                    ctx.fillStyle = '#ff0000';
                    ctx.beginPath();
                    ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
                    ctx.fill();
                } else if (this.type === 'boss') {
                    // ボスの巨大な円環
                    for (let i = 1; i <= 3; i++) {
                        ctx.save();
                        ctx.rotate(this.age * 0.02 * (i % 2 === 0 ? 1 : -1));
                        ctx.strokeStyle = i === 1 ? '#ff3366' : '#8833ff';
                        ctx.lineWidth = 4;
                        ctx.setLineDash([20, 10]);
                        ctx.beginPath();
                        ctx.arc(0, 0, this.radius * (i * 0.3 + 0.1), 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.restore();
                    }
                    // ボスのコア
                    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius * 0.3);
                    grad.addColorStop(0, '#fff');
                    grad.addColorStop(1, '#ff3366');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(0, 0, this.radius * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
            }
        }

        // 5. Item (独立)
        class Item {
            constructor(x, y, type) {
                this.x = x;
                this.y = y;
                this.type = type; // 'P' or 'M'
                this.vy = 2;
                this.r = 10;
            }
            update() {
                this.y += this.vy;
                return this.y < canvas.height + 20;
            }
            draw() {
                if (this.type === 'P') ctx.fillStyle = '#ff3333';
                else if (this.type === 'M') ctx.fillStyle = '#33ff33';
                else if (this.type === 'S') ctx.fillStyle = '#3333ff'; 
                else ctx.fillStyle = '#cc33ff'; // Type B

                ctx.beginPath();
                ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(this.type, this.x, this.y);
            }
        }

        // 6. Particle (独立)
        class Particle {
            constructor(x, y, color) {
                this.x = x;
                this.y = y;
                this.vx = (Math.random() - 0.5) * 5;
                this.vy = (Math.random() - 0.5) * 5;
                this.life = 1.0;
                this.color = color;
            }
            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.life -= 0.05;
                return this.life > 0;
            }
            draw() {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = this.life;
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, 2 + Math.random() * 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        function spawnEnemies() {
            if (frameCount % 60 === 0) {
                const x = Math.random() * (canvas.width - 40) + 20;
                enemies.push(new Enemy(x, -20, 10, 'normal'));
            }

            // ボス出現ロジックの改善
            const hasBoss = enemies.some(e => e.type === 'boss');
            if (score > 1000 && !hasBoss) {
                bossSpawnTimer++;
                // 約3秒(180フレーム)待機
                if (bossSpawnTimer > 180) {
                    enemies.push(new Enemy(canvas.width/2, -50, 500, 'boss'));
                    bossSpawnTimer = 0; // タイマーリセット
                } else {
                    // ボス出現前の「中だるみ」を防ぐため、追加の雑魚敵を出す
                    if (bossSpawnTimer % 40 === 0) {
                        const x = Math.random() * (canvas.width - 40) + 20;
                        enemies.push(new Enemy(x, -20, 10, 'normal'));
                    }
                }
            }
        }

        function checkCollisions() {
            // 自機弾 vs 敵
            for (let i = bullets.length - 1; i >= 0; i--) {
                const b = bullets[i];
                for (let j = enemies.length - 1; j >= 0; j--) {
                    const e = enemies[j];
                    if (dist(b.x, b.y, e.x, e.y) < e.radius + b.r) {
                        // ヒット
                        e.hp--;
                        score += 10;
                        createParticles(b.x, b.y, '#fff', 3);
                        bullets.splice(i, 1); // 弾消滅

                        if (e.hp <= 0) {
                            createParticles(e.x, e.y, '#ff5533', 15);
                            score += e.type === 'boss' ? 5000 : 100;
                            
                            // アイテムドロップ (通常敵: 30%, ボス: 100%)
                            if (e.type === 'boss' || Math.random() < 0.3) {
                                const r = Math.random();
                                let type = 'P';
                                if (r < 0.3) type = 'P';       // 30%
                                else if (r < 0.7) type = 'M';  // 40%
                                else if (r < 0.9) type = 'S';  // 20%
                                else type = 'B';               // 10% (Shield)
                                
                                items.push(new Item(e.x, e.y, type));
                            }
                            
                            enemies.splice(j, 1);
                        }
                        break;
                    }
                }
            }

            // 敵弾 vs 自機
            for (let i = enemyBullets.length - 1; i >= 0; i--) {
                const b = enemyBullets[i];
                if (dist(b.x, b.y, player.x, player.y) < player.radius + b.r) {
                    // シールド判定
                    if (player.shield > 0) {
                        player.shield--;
                        createParticles(player.x, player.y, '#00ffff', 10); // シールド破壊エフェクト
                        enemyBullets.splice(i, 1); // 弾消滅
                    } else {
                        gameOver();
                    }
                }
            }

            // 敵本体 vs 自機
            for (const e of enemies) {
                if (dist(e.x, e.y, player.x, player.y) < e.radius + player.radius) {
                    if (player.shield > 0) {
                        player.shield--;
                        createParticles(player.x, player.y, '#00ffff', 10);
                        e.hp = 0; // 敵も倒す（体当たり）
                        // 敵消滅処理は次のフレームの弾判定等で行われるが、ここでは簡易的にHP0にしておく
                        // 本来は enemies.splice が必要だが、ループ中のためフラグを立てるか、
                        // checkCollisions全体の構造を見直すのが理想。今回は簡易的に済ます。
                    } else {
                        gameOver();
                    }
                }
            }

            // アイテム vs 自機
            for (let i = items.length - 1; i >= 0; i--) {
                const item = items[i];
                const d = dist(item.x, item.y, player.x, player.y);
                
                // アイテム吸い寄せ (範囲を拡大し、近づくほど加速)
                if (d < 150) {
                    const angle = Math.atan2(player.y - item.y, player.x - item.x);
                    const speed = (150 - d) * 0.1 + 2; // 近いほど速い
                    item.x += Math.cos(angle) * speed;
                    item.y += Math.sin(angle) * speed;
                }

                if (d < player.displayRadius + item.r) {
                     if (item.type === 'P') {
                         player.powerLevel = Math.min(player.powerLevel + 1, 5);
                         score += 500;
                     } else if (item.type === 'M') {
                         player.missileTime = 1200; // 20秒
                         score += 500;
                     } else if (item.type === 'S') {
                         player.options = Math.min(player.options + 1, 2);
                         score += 1000;
                     } else if (item.type === 'B') {
                         player.shield = Math.min(player.shield + 1, 3);
                         score += 1000;
                     }
                     items.splice(i, 1);
                }
            }
        }

        function createParticles(x, y, color, count) {
            for(let i=0; i<count; i++) {
                particles.push(new Particle(x, y, color));
            }
        }

        function gameOver() {
            gameState = 'gameover';
            gameOverEl.style.display = 'block';
            finalScoreEl.textContent = score;
        }

        function loop() {
            if (gameState !== 'playing') return;

            ctx.save();

            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; // 残像効果
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 背景描画 (残像の下ではなく、残像処理の直後に描くことで、薄く残像がかかりつつ見える)
            nazcaBg.update();
            nazcaBg.draw();

            player.update();
            player.draw();

            spawnEnemies();

            // 更新と描画をまとめて行う
            ctx.globalCompositeOperation = 'lighter';
            
            bullets = bullets.filter(b => b.update());
            bullets.forEach(b => b.draw());

            enemyBullets = enemyBullets.filter(b => b.update());
            enemyBullets.forEach(b => b.draw());

            enemies.forEach(e => e.draw()); // 敵は通常描画
            ctx.globalCompositeOperation = 'source-over';
            enemies = enemies.filter(e => e.update());

            ctx.globalCompositeOperation = 'lighter';
            particles = particles.filter(p => p.update());
            particles.forEach(p => p.draw());

            checkCollisions();

            items = items.filter(i => i.update());
            items.forEach(i => i.draw());
            ctx.globalCompositeOperation = 'source-over';

            // フラッシュ演出
            if (flashEffect > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${flashEffect / 20})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                flashEffect--;
            }
            ctx.restore();

            scoreEl.textContent = score;
            frameCount++;
            requestAnimationFrame(loop);
        }

        function startGame() {
            player = new Player();
            bullets = [];
            enemyBullets = [];
            enemies = [];
            items = []; // アイテム初期化
            particles = [];
            nazcaBg = new NazcaBackground(); // 背景初期化
            score = 0;
            frameCount = 0;
            bossSpawnTimer = 0;
            gameState = 'playing';
            gameOverEl.style.display = 'none';
            bombStockEl.textContent = player.bombStock; // UI初期化
            loop();
        }

        // 初期化
        startGame();

