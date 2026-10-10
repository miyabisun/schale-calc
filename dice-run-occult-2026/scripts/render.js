// results.json から公開ページの HTML を作る。副作用なし。

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
};

// 結論の1文目で使う、各使い方の要点
const SUMMARY = {
  A: '4の確定サイコロをスタートに止まるために使い、他はカケラ12個のマスに止まるまで残す',
  B: '4の確定サイコロを神名のカケラ12個のマスで使い、カケラ8個のマスへ進む',
  C: 'スタートに止まれる確定サイコロを積極的に使う',
  D: '1の確定サイコロだけを残し、他はスタートに止まるためにも使う',
};

const sq = (n) => `マス${n}（${BOARD[n]}）`;
const num = (x, digits = 1) => x.toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (x) => `${x >= 0 ? '+' : '−'}${num(Math.abs(x))}`;
const label = (name) => `${name}「${NAMES[name]}」`;

function comparisonRows(main) {
  return main.ranking.map((name, i) => {
    const s = main.strategies[name];
    const cell = (v, unit = '', digits = 1) => `<td>${num(v.mean, digits)}${unit}<span class="sub">±${num(v.half, digits)}</span></td>`;
    const badge = i === 0 ? '<span class="badge">最多</span>' : '';
    return `<tr><th class="text${i === 0 ? ' best' : ''}">${label(name)}${badge}</th>${cell(s.kakera)}${cell(s.report)}${cell(s.credit, '万', 0)}</tr>`;
  }).join('');
}

function diffItems(run) {
  const [best] = run.ranking;
  return run.ranking.slice(1).map((name) => {
    const d = run.diffs[name];
    return `<li>${best}は${name}より平均${signed(d.mean)}個（95%信頼区間 ${signed(d.mean - d.half)}〜${signed(d.mean + d.half)}個）</li>`;
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

function renderReport({ main, independent, table }) {
  const [best, second] = main.ranking;
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
<p class="lead">復刻「我らオカルト研究会」（2026年10月7日から）のミニゲームで、確定サイコロの使い方を4通り比べました。普通のサイコロを200回振る遊び方を500パターン用意し、どの使い方でも同じ目の並びで試しています。</p>
</header>

<section class="card" aria-labelledby="conclusion">
<h2 id="conclusion">結論</h2>
<p class="answer"><strong>${SUMMARY[best]}（${label(best)}）</strong>使い方で、神名のカケラが最も多く集まりました。</p>
<p>500パターンの平均は${num(main.strategies[best].kakera.mean)}個です。2位の${label(second)}より平均${num(main.diffs[second].mean)}個多く、${others.join('・')}より${num(Math.min(...otherDiffs))}〜${num(Math.max(...otherDiffs))}個多くなりました。</p>
</section>

<section class="card" aria-labelledby="comparison">
<h2 id="comparison">使い方ごとの獲得数</h2>
<table>
<thead><tr><th>使い方</th><th>カケラ</th><th>レポート</th><th>クレジット</th></tr></thead>
<tbody>${comparisonRows(main)}</tbody>
</table>
<p class="note">500パターンの平均です。カケラは神名のカケラ、レポートは育成用アイテムの個数です。±は平均の95%信頼区間の幅です。</p>
</section>

<section class="card" aria-labelledby="howto">
<h2 id="howto">それぞれの使い方</h2>
<p>普通のサイコロを振る前に、次の手順1と手順2を順に確かめます。当てはまった確定サイコロを使ったら、止まったマスでもう一度手順1から確かめます。どれにも当てはまらなければ、普通のサイコロを振ります。判断に使うのは、今いるマスと手持ちの確定サイコロだけです。次に出る目は使いません。</p>
<h3>手順1. 4通りに共通する使い方</h3>
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
</ul>
<h3>手順3. 200回振り終えた後の使い切り方</h3>
<p>手持ちの確定サイコロを使う順番をすべて考え、神名のカケラが最も多く取れる順番の1個目を使います。この順番では、途中でスタートに止まって受け取る確定サイコロは数えません。受け取ったら、その時点の手持ちで順番を考え直します。4通りとも同じ方法で使い切ります。</p>
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
