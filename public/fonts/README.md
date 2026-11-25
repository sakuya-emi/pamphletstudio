# 同梱フォント

Noto Sans CJK JP、SIL Open Font License 1.1（LICENSE.txt）。Arialは同梱していません。

公式配布元： https://github.com/notofonts/noto-cjk

今回の静的TrueTypeは `Sans/Variable/TTF/NotoSansCJKjp-VF.ttf` からfontTools 4.68.0のinstantiateVariableFontでwght=500と700を固定して生成しました。画面とPDFに同じフォントを使います。再生成はPythonとfonttoolsを用意し、次のように実行できます（通常利用では不要）。

```python
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
for weight, label in [(500, 'Medium'), (700, 'Bold')]:
    font = TTFont('NotoSansCJKjp-VF.ttf')
    instantiateVariableFont(font, {'wght': weight}, inplace=True).save(
        f'NotoSansCJKjp-{label}.ttf')
```

pdf-lib/fontkitによるOTF出力やTrueTypeのサブセット化は今回の検証で表示欠落が発生したため採用せず、静的TrueType全体の埋め込みを使っています。

同梱ファイルでは、静的化後の名前テーブルもMedium / Boldに合わせています。グリフの輪郭はそれぞれwght=500 / 700です。
