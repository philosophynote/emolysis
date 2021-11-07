# emolysis(仮)

## HTML/CSS 

HTMLは４ファイルに分かれています。
- index.html
  患者が利用する際のTOPページです。
  個人情報の利用に同意し、ボタンをクリックするとkranke.htmlに飛びます

- kranke.html
  患者側のページです。
  skywayのキー（今はありませんが）を入力して発信ボタンをクリックすると
  医者の顔が表示されます。
  また、右上に患者の顔が表示されます。

- dokdor_on.html
  医者側のページです。
  患者側と同じくskywayのキーを入力することで患者の顔が表示されます。
  左下のボタンをクリックすることで感情分析が開始され、
  右側にグラフが表示されます。
  診察終了後はメッセージボタンをクリックすることで患者にメッセージが表示されます。

- dokdor_to.html
  対面診療の際に使用するページです。
  HTMLとCSSだけであれば、dokdor_on.htmlと内容は変わりません。

CSSは５ファイルです。
私は作成に携わっていないため、どのCSSがどのHTMLに対応しているかのみ説明します。
- reset.css→全て
- style.css→index.html
- sw.css→kranke.html
- dokdorsw.css→dokdor_on.html
- dokdorswon.css→dokdor_to.html
(cssの名前とhtmlの名前が対応していないように思われますがこの通りでした。
ちなみにdokdorsw.cssとdokdorswon.cssの中身は同じです)
