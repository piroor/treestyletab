# nova/ ディレクトリの更新方針

このディレクトリには、Firefox 本体(Nova デザイン)の CSS をそのまま、または部分的に改変して取り込んだファイルと、
Tree Style Tab (TST) 独自の CSS が混在している。

- **`nova.css` だけは TST 独自ファイル。Firefox 本体からの流用ではない。**
- それ以外の全ファイルは Firefox 本体のソースを流用したもの。各ファイル冒頭に
  `/* https://searchfox.org/firefox-main/rev/<リビジョンハッシュ>/<元ファイルパス> */`
  という形式で、取得時点の permalink がコメントとして記載されている。

このドキュメントは、その流用ファイル群を最新の Firefox 本体のソースに追従させて更新する際の手順を、
Claude Code などの AI エージェントが再現できるようにまとめたものである。

## 対象ファイルと流用元

| ローカルファイル | 流用元(mozilla-firefox/firefox 上のパス) |
| --- | --- |
| `tokens-shared.css` | `toolkit/themes/shared/design-system/dist/tokens-shared.css` |
| `toolbar.css` | `toolkit/themes/shared/design-system/src/toolbar.css` |
| `tabs.css` | `browser/themes/shared/tabbrowser/tabs.css` |
| `tab.tokens.css` | `browser/themes/shared/tabbrowser/tab.tokens.css` |
| `browser-shared.css` | `browser/themes/shared/browser-shared.css` |
| `browser-colors.css` | `browser/themes/shared/browser-colors.css` |
| `tokens-platform.css` | `toolkit/themes/shared/design-system/dist/tokens-platform.css` |

`nova.css` はこの表に含まれない。ただし更新作業の影響を受けることがある(後述)。

## 重要: Firefox のソース取得元

Firefox のソースは Mercurial (`hg.mozilla.org/mozilla-central`) から Git
(`https://github.com/mozilla-firefox/firefox`) に移行済み。**`hg.mozilla.org` は当時の古いリビジョンにしか
アクセスできず、最新化の基準にはならない。** searchfox の `firefox-main` ツリーも、この Git リポジトリの `main`
ブランチを指している。

- 最新リビジョン(コミットハッシュ)の取得:
  ```
  curl -s "https://api.github.com/repos/mozilla-firefox/firefox/commits/main"
  ```
  レスポンスの `.sha` が最新リビジョン、`.commit.author.date` がその日時。
- 任意のリビジョンでの特定ファイルの取得:
  ```
  https://raw.githubusercontent.com/mozilla-firefox/firefox/<リビジョンハッシュ>/<ファイルパス>
  ```
  (各ローカルファイル冒頭の permalink コメントに書かれているリビジョンハッシュと、上記で取得した最新リビジョン
  ハッシュの両方で取得し、比較材料にする。)

## 更新手順の全体像

1. 各対象ファイル冒頭の permalink コメントから、現在取り込まれているリビジョンハッシュと元ファイルパスを読み取る。
2. 最新リビジョンハッシュを取得する。
3. 各ファイルについて、「現在のリビジョン」と「最新リビジョン」の両方の内容を上記の raw URL で取得する。
4. 2つの内容を `diff` で比較し、変更点(値の追加・削除・変更、カスタムプロパティ名のリネームなど)を把握する。
   diff が空なら、そのファイルは permalink コメントのリビジョンハッシュを更新するだけでよい。
5. 差分が存在するファイルについては、以下の「ローカルの構造的改変パターン」を踏まえて、値の変更だけをローカル
   ファイルに反映する。**diff をそのまま当てはめるのではなく、セクション(`@layer` ブロック)単位で内容を
   Firefox 側の最新版に置き換え、TST 側のラッパー構造(セレクターやインデント)を維持する方法が安全。**
   具体的な手順:
   1. 最新版ファイルで `@layer tokens-xxx {` の出現行と、対応する閉じ括弧の行を特定する
      (`grep -n "@layer tokens\|^  }\|^    }\|^      }\|^        }"` などで洗い出す)。
   2. 各 `@layer` ブロックの中身(プロパティ定義)だけを `sed` 等で抜き出す。
   3. ローカルファイルの対応するブロックの現在のインデント幅を確認し、Firefox 側のネスト段数との差だけ
      インデントを詰める(次節「インデントの差」を参照)。
   4. 抜き出した内容を、ローカル側の既存のラッパー(セレクターや `/* コメントアウトされた @media */` の記法)に
      そのまま差し込む。
   5. 差し替えが終わったら、**同じリビジョンの「現在の内容」を同じ手順でセクション抽出・ラップし、ローカル
      ファイルの現状と一致するか照合する**。一致すれば、抽出・ラップの手順自体が正しいことの裏付けになる
      (このリポジトリの過去の更新作業で実際にこの検証を行い、正しく機能することを確認済み)。
6. カスタムプロパティが**リネーム**されている場合は、そのファイル単体の更新だけでは不十分。
   「リネームされた変数の伝播」の節を参照。
7. 各ファイル冒頭の permalink コメントのリビジョンハッシュを、取得した最新リビジョンハッシュに更新する。
8. 検証を行う(「検証手順」を参照)。
9. 変更をまとめて日本語で説明する。

## ローカルの構造的改変パターン

TST 側のファイルは、Firefox 本体の CSS をそのまま使えないため、次のような改変が一貫して行われている。
セクションの中身(プロパティの値)を更新する際は、この改変パターンを壊さないこと。

- **`@layer` と `:root` のネスト順序が逆**。
  Firefox 本体: `:root, :host(...) { @layer tokens-foundation { --prop: value; } }`
  TST ローカル: `@layer tokens-foundation { :root { --prop: value; } }`
  (`@layer` を外側、`:root` を内側にして、`:host(...)` は削除する。)
- **`@media -moz-pref("browser.nova.enabled")` は丸ごと削除**し、中身の `@layer` だけを取り出す。
  (nova テーマの CSS ファイルは、nova テーマが有効なときにしか読み込まれない前提のため、pref 判定自体が不要。)
- **`@media (forced-colors)` は実際の `@media` としては使わず、コメントアウトした上で
  `:root.forced-colors` というクラスセレクターに置き換える**。
  ```css
  @layer tokens-forced-colors-nova {
    /*@media (forced-colors) {*/
      :root.forced-colors {
        --prop: value;
      }
    /*}*/
  }
  ```
- **`:root:is([theme-in-app], :not([lwtheme])), :host {}` は
  `:root:not([color-scheme="system-color"])/*:is([theme-in-app], :not([lwtheme]))*/:not(.lwtheme-applied) {}`
  に置き換える**(元のセレクターはコメントとして残す)。同様に `@media not ((forced-colors) or
  (-moz-native-theme))` もコメントアウトする。
- **`@media (-moz-native-theme)` 相当は `&[color-scheme="system-color"]` のような属性セレクターに、
  `@media (-moz-platform: macos)` は `&.mac` のようなクラスセレクターに置き換えられている場合がある**
  (`tabs.css` 参照)。既存の記法を踏襲すること。
- 上記のいずれも、**「元のセレクター/@media をコメントとして残しつつ、TST の実行環境で機能する別のセレクター/
  クラスに読み替える」という一貫した方針**である。迷ったら、同じファイル内の他のブロックが採用している記法を
  真似ること。

### インデントの差

ネスト段数が変わる(通常は 1〜2 段減る)ため、プロパティ行のインデント幅を調整する必要がある。
「Firefox 側のインデント幅」と「ローカル側の同種ブロックの既存インデント幅」を突き合わせ、その差分(2 スペース
刻みが基本)だけ `sed 's/^  //'` 等で詰める。ファイルによって、また同じファイル内でもブロックによって詰める幅が
異なることがあるので、**ブロックごとに個別に確認すること**(例: `tab.tokens.css` の
`tokens-browser-theme-nova` は他のブロックと詰め幅が異なる)。

## リネームされた変数の伝播

Firefox 側でカスタムプロパティ名がリネーム/再設計されることがある(追加・削除だけでなく、意味も含めた作り直し)。
この場合、そのファイル単体を更新するだけでは他のファイルが参照している古い変数名が宙に浮き、スタイルが
静かに壊れる(値が空になるだけで、CSS エラーにはならないので気づきにくい)。

**リネームが疑われたら、必ず以下を確認すること:**

1. 更新対象ファイル自身の new/old 版を比較し、同じ役割の変数が別名になっていないか確認する
   (例: 過去の更新で `tab.tokens.css` の `--tab-outline` → `--tab-border`、
   `--tab-loading-fill` → `--tab-icon-fill-loading`、`--tab-selected-textcolor` → `--tab-text-color-selected`、
   `--tab-selected-outline-color` → `--tab-border-color-selected` 等の大規模なリネームが発生した)。
2. `nova.css` を含む `nova/` 配下の全ファイルに対して、リネーム前の変数名を
   `grep -n -- '--old-name'` で検索し、参照している箇所をすべて新しい名前に書き換える。
   `nova.css` は流用元ファイルではないが、これらのトークンの**消費者**であるため、参照の書き換えは
   必要な追従作業であり、「nova.css には手を入れない」という原則の例外である。
3. 逆に、ある流用ファイルの forced-colors 系セクションから特定の変数の明示的な上書きが**削除**されている
   場合、それは「他のトークン経由の参照チェーンで自動的に正しい値になるよう再設計された」ためであることが
   多い。安易に「削除された値を復元する」のではなく、削除後の参照チェーン(他のファイルの同名トークン定義)を
   たどって、意図通りの値になるか確認すること。

## 文字コード/改行コードの注意

このリポジトリは原則として改行コードをLFに統一する。希にCR+LFが混入している場合があり、`diff` の差分が
無用に多く検出されることがあるが、その場合は `diff` の `-w` オプションを用いるなどして改行コードの違いを
無視して比較する。

## 検証手順

1. 各ファイルについて `{` と `}` の出現数が一致することを確認する(構文的に閉じ忘れがないか)。
2. 組み立てたファイル内容を、更新前のローカルファイルおよび新リビジョンの Firefox 側ファイルと突き合わせ、
   意図した差分だけが含まれていることを確認する(想定外の内容欠落・重複がないか)。
3. `nova/` 配下の全ファイルに対して、リネームされた変数の旧名が残っていないか最終的に `grep` で確認する。
4. `git diff --stat` で変更されたファイル・行数の概要を確認し、想定より大きく変わっているファイルがあれば
   改行コード等の問題を疑う。
5. 可能であれば実際に拡張機能を起動し、nova テーマの見た目(タブの背景色、選択タブのアウトライン、
   スロバーの色など、変更したトークンに関連する箇所)が壊れていないか目視確認する。

## 最後に

各ファイル冒頭の permalink コメントは、次回の更新作業の起点になる。更新を終えたら必ず新しいリビジョン
ハッシュに書き換えること。またこのドキュメント自体も、更新方針に変更があれば追従して直すこと。
