// results.json から公開ページの HTML を作る。副作用なし。

const { move } = require('./dice-run.js');

const REPO = 'https://github.com/miyabisun/schale-calc/tree/main/dice-run-occult-2026';

const BOARD = [
  'スタート（確定サイコロ1個）', '装備設計図218', 'オーパーツ5', 'オーパーツ5', '3マス進む',
  'レポート8', '装備設計図218', 'オーパーツ4', '神名のカケラ12', '装備強化珠7', '1マス進む',
  'クレジット300万', '神名のカケラ8', 'オーパーツ4', '装備強化珠4', 'レポート8', '2マス進む', '装備強化珠7',
];

const NAMES = {
  A: '4でスタートを狙う',
  B: '4をカケラ12のマスで使う',
  C: 'スタートを積極的に狙う',
  D: '1を残してスタートを狙う',
  E: '余りをカケラ8のマスとスタートで使う',
};

// 結論の1文目で使う、各使い方の要点
const SUMMARY = {
  A: '4の確定サイコロをスタートに止まるために使い、他はカケラ12個のマスに止まるまで残す',
  B: '4の確定サイコロを神名のカケラ12個のマスで使い、カケラ8個のマスへ進む',
  C: 'スタートに止まれる確定サイコロを積極的に使う',
  D: '1の確定サイコロだけを残し、他はスタートに止まるためにも使う',
  E: '4の確定サイコロを神名のカケラ12個のマスで使い、残りの回数で使い切れないほど持っていれば、カケラ8個のマスやスタートに止まるためにも使う',
};

// 最適な使い方とBの判断が分かれた場面の説明。キーは「現在地:手持ち:最適な判断」
const SCENE_REASONS = {
  '7:0000010:5': (s) => `5でカケラ12個のマスに止まれるのは、マス3にいるときだけです。1周する間（普通のサイコロで約5回）にマス3に止まる確率は、4分の1ほどです。残りが${s.upTo}回以下では、マス3を待っても止まれないまま終わることが多いので、今5でマス12に進んでカケラ8個を取ります。`,
  '9:0001000:3': (s) => `3でカケラ12個のマスに止まれるのは、マス5にいるときだけです。残りが${s.upTo}回以下では、マス5を待つより、今3でマス12に進んでカケラ8個を取る方が多く取れます。`,
  '11:0100000:1': (s) => `1でカケラ12個のマスに止まれるのは、マス7にいるときだけです。残りが${s.upTo}回以下では、マス7を待つより、今1でマス12に進んでカケラ8個を取ります。`,
  '14:0010000:2': (s) => `2でカケラ12個のマスに止まれるのは、マス6にいるときだけです。2を使うとマス16の「2マス進む」からスタートに止まり、確定サイコロを1個受け取るので、手持ちの数は減りません。使い道が1か所しかない2を、1〜6のどれかになる新しい1個と取り替える形です。さらに次はスタートから振るので、6回に5回はマス2・3・5・6・7のどこかに止まります。そこからは確定サイコロでカケラ12個のマスに届きます。残りが${s.upTo}回以下なら、こちらの方が得です。`,
  '14:0020000:2': (s) => `2が2個あると、マス6で使う分を残しても1個余ります。余った1個でスタートに止まると、手持ちの数を減らさずに、新しい目の確定サイコロと取り替えられます。次はスタートから振るので、6回に5回は確定サイコロでカケラ12個のマスに届く位置に止まります。残りが${s.upTo}回以下なら、こちらの方が得です。`,
};

const sq = (n) => `マス${n}（${BOARD[n]}）`;
const num = (x, digits = 1) => x.toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (x) => `${x >= 0 ? '+' : '−'}${num(Math.abs(x))}`;
const label = (name) => `${name}「${NAMES[name]}」`;

const handText = (hand) => hand.map((c, f) => (c ? `${f}が${c}個` : '')).filter(Boolean).join('と');
const place = (n) => (n === 0 ? 'スタート' : sq(n));
const actionText = (pos, f) => (f ? `${f}を使う（${place(move(pos, f).pos)}に止まる）` : '普通のサイコロを振る');
const interval = (d) => `${signed(d.mean)}個（95%信頼区間 ${signed(d.mean - d.half)}〜${signed(d.mean + d.half)}個）`;

function sceneItems(scenes) {
  return scenes.map((s) => {
    const reason = SCENE_REASONS[`${s.pos}:${s.hand.join('')}:${s.optimal}`];
    if (!reason) throw new Error(`場面の説明がありません: マス${s.pos} ${handText(s.hand)}`);
    return `<li><strong>${sq(s.pos)}、手持ちは${handText(s.hand)}</strong><br>
最適：${actionText(s.pos, s.optimal)}<br>
B：${actionText(s.pos, s.b)}<br>
期待値の差 ${signed(s.diff)}個（${s.count}回）
<p>${reason(s)}</p></li>`;
  }).join('');
}

const cell = (v, unit = '', digits = 1) => `<td>${num(v.mean, digits)}${unit}<span class="sub">±${num(v.half, digits)}</span></td>`;
const amounts = (s) => `${cell(s.kakera)}${cell(s.report)}${cell(s.credit, '万', 0)}`;

function comparisonRows(main, optimal) {
  const rows = main.ranking.map((name, i) => {
    const badge = i === 0 ? '<span class="badge">最多</span>' : '';
    return `<tr><th class="text${i === 0 ? ' best' : ''}">${label(name)}${badge}</th>${amounts(main.strategies[name])}</tr>`;
  });
  rows.push(`<tr><th class="text">参考：最適な使い方</th>${amounts(optimal)}</tr>`);
  return rows.join('');
}

function diffItems(run) {
  const [best] = run.ranking;
  return run.ranking.slice(1).map((name) => {
    const d = run.diffs[name];
    return `<li>${best}は${name}より平均${interval(d)}</li>`;
  }).join('');
}

const separated = (run) => Object.values(run.diffs).every((d) => d.mean - d.half > 0);

function boardRows() {
  const rows = [];
  for (let i = 0; i < 9; i++) rows.push(`<tr><td>${i}</td><td class="text">${BOARD[i]}</td><td>${i + 9}</td><td class="text">${BOARD[i + 9]}</td></tr>`);
  return rows.join('');
}

function uniformityRows(table) {
  const rows = [1, 2, 3, 4, 5, 6].map((f) => `<tr><th class="text">${f}</th><td>${table.normal.counts[f - 1].toLocaleString('ja-JP')}</td><td>${table.fixed.counts[f - 1].toLocaleString('ja-JP')}</td></tr>`);
  rows.push(`<tr><th class="text">カイ二乗値</th><td>${num(table.normal.chi2, 2)}</td><td>${num(table.fixed.chi2, 2)}</td></tr>`);
  return rows.join('');
}

function renderReport({ main, independent, table, optimal }) {
  const [best, second] = main.ranking;
  const n = main.ranking.length;
  const [lastLimit] = optimal.limits.slice(-1);
  const [prevLimit] = optimal.limits.slice(-2);
  const sceneHtml = sceneItems(optimal.scenes);
  const ones = optimal.scenes.filter((s) => s.hand.reduce((a, b) => a + b, 0) === 1).map((s) => s.upTo);
  const twos = optimal.scenes.filter((s) => s.hand.reduce((a, b) => a + b, 0) === 2).map((s) => s.upTo);
  const others = main.ranking.slice(2);
  const gaps = Object.values(main.strategies).map((s) => s.endGap);
  const maxReceived = Math.max(...Object.values(main.strategies).map((s) => s.maxFixedReceived));
  const sameRanking = main.ranking.join('') === independent.ranking.join('');
  const otherDiffs = others.map((n) => main.diffs[n].mean);

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>サイコロランの確定サイコロの使い方 | schale-calc</title>
<meta name="description" content="復刻「我らオカルト研究会」のサイコロランで、確定サイコロの使い方ごとに神名のカケラの数を比べた結果です。">
<link rel="stylesheet" href="../assets/site.css">
</head>
<body><main>
<nav class="nav"><a href="../">計算結果の一覧</a></nav>
<header>
<h1>サイコロランの確定サイコロの使い方</h1>
<p class="lead">復刻「我らオカルト研究会」（2026年10月7日から）のミニゲームで、確定サイコロの使い方を${n}通り比べました。普通のサイコロを200回振る遊び方を500パターン用意し、どの使い方でも同じ目の並びで試しています。あわせて、神名のカケラの期待値が最大になる使い方を計算で求め、手で追える使い方がどこまで届くかを調べました。</p>
</header>

<section class="card" aria-labelledby="conclusion">
<h2 id="conclusion">結論</h2>
<p class="answer"><strong>${SUMMARY[best]}（${label(best)}）</strong>使い方で、神名のカケラが最も多く集まりました。</p>
<p>500パターンの平均は${num(main.strategies[best].kakera.mean)}個です。2位の${label(second)}より平均${num(main.diffs[second].mean)}個多く、${others.join('・')}より${num(Math.min(...otherDiffs))}〜${num(Math.max(...otherDiffs))}個多くなりました。</p>
<p>計算で求めた、期待値が最大になる使い方は、同じ500パターンで平均${num(optimal.kakera.mean)}個でした。状況ごとに判断が変わるため手で追うのは難しく、${best}との差は平均${num(optimal.diffs[best].mean)}個です。</p>
</section>

<section class="card" aria-labelledby="comparison">
<h2 id="comparison">使い方ごとの獲得数</h2>
<table>
<thead><tr><th>使い方</th><th>カケラ</th><th>レポート</th><th>クレジット</th></tr></thead>
<tbody>${comparisonRows(main, optimal)}</tbody>
</table>
<p class="note">500パターンの平均です。カケラは神名のカケラ、レポートは育成用アイテムの個数です。±は平均の95%信頼区間の幅です。「最多」は手で追える使い方の中での順位です。最適な使い方は次の節で説明します。</p>
</section>

<section class="card" aria-labelledby="optimal">
<h2 id="optimal">最適な使い方との比較</h2>
<p>次に出る目を知らずに、神名のカケラの期待値が最大になるように確定サイコロを使う方法を計算で求めました。最初の確定サイコロ16個の目も決まっていない状態から数えた期待値は<strong>${num(optimal.expected)}個</strong>です。この値は下限で、本当の最大値はこれ以上です。理由は下の「計算の方法」に書きます。</p>
<p>同じ500パターンで走らせると平均${num(optimal.kakera.mean)}個で、Bより平均${interval(optimal.diffs.B)}多くなりました。${best === 'B' ? '' : `${label(best)}との差は平均${interval(optimal.diffs[best])}です。`}</p>
<h3>判断が分かれた場面</h3>
<p>500パターンを最適な使い方で進め、Bなら別の判断をする場面を数えました（全部で${optimal.divergences.toLocaleString('ja-JP')}回）。回数の多い順に5つを示します。期待値の差は、その場面で最適な判断をした場合と、Bの判断をして後は最適に進めた場合の、カケラの期待値の差の平均です。</p>
<ol>${sceneHtml}</ol>
<p>5つとも、Bは普通のサイコロを振り、最適な使い方は確定サイコロを使います。手持ちが少なく、残りの回数も少ないとき、カケラ12個のマスを待たずに、カケラ8個のマス（マス12）やスタートで使う判断です。</p>
<h3>計算の方法</h3>
<p>最後の1回から逆にたどって求めました。</p>
<ol>
<li>遊んでいる途中の状況を「残りの普通のサイコロの回数・今いるマス・手持ちの確定サイコロ（目ごとの個数）」で表します。次に出る目は状況に含めません。</li>
<li>残り0回の状況では、手持ちを使い切る順番をすべて試し、カケラの期待値が最も大きい値を求めます。スタートで受け取る確定サイコロは、1〜6が同じ確率で出るものとして平均します。</li>
<li>残り1回の状況では、「普通のサイコロを振る」と「1〜6のどれかの確定サイコロを使う」のそれぞれについて、その後に取れるカケラの期待値を、すでに求めた状況の値から計算します。普通のサイコロは1〜6の目を同じ確率で平均します。期待値がいちばん大きいものを、その状況での判断とし、その期待値を状況の値とします。</li>
<li>残り2回、3回…と200回まで同じ計算を繰り返します。</li>
</ol>
<p>手持ちの組み合わせは、個数が増えると急に増えます。そこで計算では手持ちを合計${lastLimit.limit}個までとし、${lastLimit.limit}個持っているときにスタートで受け取った確定サイコロは捨てました。実際に遊ぶときも「受け取った確定サイコロを使わずに取っておく」ことはできるので、求めた期待値は本当の最大値を超えません。これが下限と書いた理由です。上限を広げたときの期待値は次の通りで、${prevLimit.limit}個から${lastLimit.limit}個に広げても${num(lastLimit.expected - prevLimit.expected, 3)}個しか変わりませんでした。本当の最大値も、ほぼこの値と考えられます。</p>
<table>
<thead><tr><th>手持ちの上限</th><th>期待値</th></tr></thead>
<tbody>${optimal.limits.map((l) => `<tr><td class="text">${l.limit}個</td><td>${num(l.expected, 2)}個</td></tr>`).join('')}</tbody>
</table>
<p>500パターンで走らせるときも、上限の${lastLimit.limit}個を持っているときに受け取った確定サイコロは取っておき、200回振り終えた後に手順3で使い切りました。</p>
<h3>手で追える使い方への置き換え（E）</h3>
<p>上の場面で最適な使い方が確定サイコロを使い始めるのは、手持ちが1個なら残りが${num(Math.min(...ones), 0)}〜${num(Math.max(...ones), 0)}回以下${twos.length ? `、2個なら残りが${num(Math.max(...twos), 0)}回以下` : ''}になってからです。持っている個数が多いほど早く使い始めます。普通のサイコロは約5回で1周するので、残りの周回で使い切れない分を、カケラ8個のマスやスタートで使っていると読めます。</p>
<p>そこで「手持ちの個数の5倍が、残りの普通のサイコロの回数以上になったら使う」という目安をBに足したのがEです。5倍という係数は、評価に使う500パターンと10,000パターンとは別の乱数で作った10,000パターン（seed 424242）で、3〜6倍を試して決めました。Eの手順は次の節にあります。</p>
</section>

<section class="card" aria-labelledby="howto">
<h2 id="howto">それぞれの使い方</h2>
<p>普通のサイコロを振る前に、次の手順1と手順2を順に確かめます。当てはまった確定サイコロを使ったら、止まったマスでもう一度手順1から確かめます。どれにも当てはまらなければ、普通のサイコロを振ります。判断に使うのは、今いるマスと手持ちの確定サイコロ（Eでは残りの普通のサイコロの回数も）だけです。次に出る目は使いません。</p>
<h3>手順1. ${n}通りに共通する使い方</h3>
<p>${sq(8)}にちょうど止まれる確定サイコロを持っていれば使います。止まれるのは次の5か所からで、目は1か所に1つだけです。</p>
<table>
<thead><tr><th>今いるマス</th><th>使う目</th></tr></thead>
<tbody>${[[2, 6], [3, 5], [5, 3], [6, 2], [7, 1]].map(([p, f]) => `<tr><td class="text">${sq(p)}</td><td>${f}</td></tr>`).join('')}</tbody>
</table>
<p>4の確定サイコロでは${sq(8)}に止まれません。${sq(0)}から4で進むとマス4の「3マス進む」で${sq(7)}に止まるためです。4をどう使うかが、使い方を分けるいちばんの違いです。</p>
<h3>手順2. 使い方ごとの追加の規則</h3>
<ul>
<li><strong>${label('A')}</strong>：4を持っていて${sq(12)}か${sq(14)}にいるときに、4を使ってスタートに止まります（マス12からはマス16の「2マス進む」を通ります）。4以外は手順1の用途にだけ使います。</li>
<li><strong>${label('B')}</strong>：4を持っていて${sq(8)}にいるときに、4を使って${sq(12)}に止まります。4以外は手順1の用途にだけ使います。</li>
<li><strong>${label('C')}</strong>：スタートにちょうど止まれる確定サイコロがあれば使います。止まれるのは${sq(11)}から5、${sq(12)}から4か6、${sq(13)}から3か5、${sq(14)}から2か4、${sq(15)}から1か3、${sq(17)}から1です。候補が2つあるときは、4があれば4を、なければ大きい目を使います。</li>
<li><strong>${label('D')}</strong>：Cと同じですが、1の確定サイコロはスタートに止まるためには使いません。${sq(15)}では3だけが候補になり、${sq(17)}では使いません。</li>
<li><strong>${label('E')}</strong>：Bの規則に加えて、手持ちの確定サイコロの個数の5倍が、残りの普通のサイコロの回数以上になったら（たとえば手持ち3個なら残り15回から）、次の目も使います。まず${sq(12)}にちょうど止まれる目（${sq(6)}から6、${sq(7)}から5、${sq(9)}から3、${sq(11)}から1）、なければCと同じくスタートにちょうど止まれる目です。</li>
</ul>
<h3>手順3. 200回振り終えた後の使い切り方</h3>
<p>手持ちの確定サイコロを使う順番をすべて考え、神名のカケラが最も多く取れる順番の1個目を使います。この順番では、途中でスタートに止まって受け取る確定サイコロは数えません。受け取ったら、その時点の手持ちで順番を考え直します。${n}通りとも同じ方法で使い切ります。</p>
<p>カケラの数が同じ順番が複数あるときは、次の順に決めます。</p>
<ol>
<li>スタートに止まる回数が多い順番</li>
<li>スタートに止まるまでに使う確定サイコロの数が少ない順番（止まるたびに数えて合計します）</li>
<li>1個目の目が小さい順番</li>
</ol>
<p>たとえば${sq(3)}で4と5が残ったときは、5でマス8（カケラ12個）、続けて4でマス12（カケラ8個）に止まり、合わせて20個取れます。4を先に使うとマス7に止まり、次の5でマス12（カケラ8個）に止まるので8個です。そのため5を先に使います。</p>
</section>

<section class="card" aria-labelledby="rules">
<h2 id="rules">計算の前提</h2>
<ul>
<li>盤面は18マスで、マス17の次はスタート（マス0）です。止まったマスの報酬を受け取ります。</li>
<li>「Xマス進む」のマスに止まると、さらにXマス進み、その先のマスの報酬だけを受け取ります。マス16の「2マス進む」でスタートに止まったときも確定サイコロを受け取ります。</li>
<li>確定サイコロはスタートにちょうど止まったときに1個受け取ります。通り過ぎたときは受け取りません。</li>
<li>16周目までは周回ごとにも確定サイコロを受け取れますが、計算を簡単にするため、最初から16個持っている扱いにしています。</li>
<li>普通のサイコロは200回振ります。確定サイコロは普通のサイコロの合間にいつでも使え、200回の回数は減りません。</li>
<li>受け取る確定サイコロの目は、1〜6のどれかが同じ確率で出ます。</li>
</ul>
<details>
<summary>盤面のマス番号</summary>
<table>
<thead><tr><th>番号</th><th class="text">マス</th><th>番号</th><th class="text">マス</th></tr></thead>
<tbody>${boardRows()}</tbody>
</table>
</details>
</section>

<section class="card" aria-labelledby="validity">
<h2 id="validity">計算が正しいかの確認</h2>
<h3>乱数表の偏り</h3>
<p>500パターンの目の並びは、計算の前に作って保存してあります。各パターンは、普通のサイコロ200回の目と、確定サイコロを受け取る順の目${table.fixedLength}個です。確定サイコロの目は先頭の16個が最初の手持ちで、最も多く受け取ったパターンでも${maxReceived}個までしか使いませんでした。</p>
<p>出た目の回数は1〜6でほぼ同じで、一様分布との差を測るカイ二乗値は、偏りを疑う目安の${num(table.normal.critical, 2)}を${table.normal.uniform && table.fixed.uniform ? '下回りました' : '上回りました'}。</p>
<details>
<summary>目ごとの回数</summary>
<table>
<thead><tr><th>目</th><th>普通のサイコロ</th><th>確定サイコロ</th></tr></thead>
<tbody>${uniformityRows(table)}</tbody>
</table>
</details>
<h3>使い方の差は偶然か</h3>
<p>同じパターン同士で神名のカケラの差を取り、その平均の95%信頼区間を求めました。${separated(main) ? `どの区間も0を含まないため、${main.ranking[0]}が最も多いという結論は乱数のばらつきでは変わらないと判断しました。` : '0を含む区間があり、1位の使い方は乱数のばらつきで入れ替わる可能性があります。'}</p>
<ul>${diffItems(main)}</ul>
<h3>別の乱数での再計算</h3>
<p>500パターンとは別に作った${independent.patterns.toLocaleString('ja-JP')}パターンで計算し直しても、順位は${independent.ranking.join(' → ')}で${sameRanking ? '変わりませんでした' : '変わりました'}。</p>
<ul>${diffItems(independent)}</ul>
<h3>使い切り方の損</h3>
<p>手順3の使い切り方は、今後受け取る確定サイコロの目まで考えて期待値が最大になる使い方と比べ、平均${num(Math.min(...gaps), 2)}〜${num(Math.max(...gaps), 2)}個だけ少なくなります。人が手で追える方法にしたための差で、結論は変わりません。</p>
<h3>プログラムの確認</h3>
<p>マスの移動、報酬、使い方ごとの判断、使い切り方は、手で計算できる短い目の並びを使ったテストで確かめています。プログラム、乱数表、集計結果は<a href="${REPO}">GitHub</a>で公開しています。</p>
</section>
<footer>Generated by dice-run-occult-2026/scripts/build.js</footer>
</main></body>
</html>
`;
}

module.exports = { renderReport, separated };
