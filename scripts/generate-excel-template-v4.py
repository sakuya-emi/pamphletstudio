"""Generate the blank and example v4 workbooks. Requires openpyxl >= 3.1."""
from pathlib import Path
from datetime import datetime
import unicodedata
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Protection
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/templates/Pamphlet-Studio-Excel-template-v3.xlsx'
ORDER = ['基本情報', 'アンケート', '学生企画', '模擬店', 'ステージ企画', '学生ステージ企画', '外部・特別企画', 'キッチンカー', '協賛企業', '広告', 'スタッフ', '挨拶', 'お知らせ・注意事項', '章・インデックス', 'ページ用テキスト']
GUIDES = {
 '基本情報': ('最初に記入', '大学名・学園祭名・開催日など。空欄の項目は既存情報を保持します。', '日付は2027-10-24、開催時間は09:30〜16:00。開催回数は整数。'),
 'アンケート': ('QR掲載時に必要', '「アンケートURL」の黄色セルに回答用URLを貼付。QR画像は不要。', 'http:// または https:// で始まるURL。見出し・本文は任意。全欄空なら既存URLを保持。'),
 '学生企画': ('掲載する場合', '企画名が必須。団体・場所は分かる範囲で記入。', 'ポスター要否は要／不要。空欄は「要」。画像はアプリで別途登録。'),
 '模擬店': ('掲載する場合', '企画名が必須。団体・場所は分かる範囲で記入。', 'ポスター要否は要／不要。空欄は「要」。画像はアプリで別途登録。'),
 'ステージ企画': ('掲載する場合', '企画名・開始時刻・終了時刻を記入。', '時刻は半角24時間制HH:MM（09:30）。ポスター空欄＝要。'),
 '学生ステージ企画': ('掲載する場合', '企画名・開始時刻・終了時刻を記入。', '時刻は半角24時間制HH:MM（13:15）。ポスター空欄＝要。'),
 '外部・特別企画': ('掲載する場合', '企画名が必須。団体・場所・時刻・備考は必要に応じて記入。', '時刻は半角24時間制HH:MM（11:00）。ポスター空欄＝要。'),
 'キッチンカー': ('掲載する場合', '会社名が必須。メニューは1セルに1品、最大5品。', '使わないメニュー欄は空欄のままで構いません。'),
 '協賛企業': ('掲載する場合', '企業名が必須。読み仮名・並び替えキーは任意。', '同じ企業は広告シートと同じ企業名に統一してください。'),
 '広告': ('掲載する場合', '企業名と広告サイズを記入。画像はアプリで別途登録。', 'サイズは1ページ／1/2ページ／1/4ページから選択。half等は記入不要。'),
 'スタッフ': ('掲載する場合', '氏名が必須。分類には役職・担当名を記入。', '分類が空欄の場合は直前の分類を引き継ぎます。最初の行には分類を記入。'),
 '挨拶': ('掲載する場合', '肩書・氏名・本文を記入。本文セル内の改行はAlt+Enter。', '同じ肩書の既存情報がある場合は登録前に更新先を確認。'),
 'お知らせ・注意事項': ('掲載する場合', '種類を選び、見出し・本文を記入。', 'アンケートURLはアンケートシートへ。両方にある場合はアンケートシート優先。'),
 '章・インデックス': ('変更するときだけ', '掲載したい章名を上から順に記入。', '空欄版には章名の見本を入れていません。既存構成を使うなら未記入で構いません。'),
 'ページ用テキスト': ('変更するときだけ', '掲載箇所と本文・項目を記入。見出しは任意。', '掲載箇所はアプリのページ名・見出しに合わせます。改行はAlt+Enter。'),
}
NAVY, YELLOW, ORANGE, BLUE, GREEN = '24435C', 'FFF2CC', 'FCE4D6', 'DDEBF7', '548235'

def rule(ws, kind, area, f1, f2=None):
    dv = DataValidation(type=kind, formula1=f1, formula2=f2, allow_blank=True,
        operator='between' if f2 is not None else None)
    dv.errorStyle = 'stop'; dv.showErrorMessage = True; dv.showInputMessage = True
    dv.errorTitle = '入力内容を確認してください'
    dv.error = '指定された形式・選択肢で入力してください。詳しくは上の案内をご覧ください。'
    dv.promptTitle = '入力の案内'
    dv.prompt = ('候補から選択してください。空欄も使用できます。' if kind == 'list' else '上の案内の形式で入力してください。空欄も使用できます。')
    dv.showDropDown = False
    ws.add_data_validation(dv); dv.add(area)

def build(example):
    source = openpyxl.load_workbook(SOURCE)
    wb = openpyxl.Workbook(); intro = wb.active; intro.title = 'はじめに'
    mode = '記入例版：すべて架空データです。そのまま本番登録しないでください。' if example else '空欄版：黄色セルに実際の情報を記入してください。架空データは入っていません。'
    guide = [
      ('Pamphlet Studio Excel雛形 v4', mode),
      ('1 ファイルを選ぶ', '本番用は空欄版。記入例版は別ファイルで参照用です。編集前に名前を付けて保存（.xlsx）。'),
      ('2 記入する順番', '左から基本情報→アンケート→各企画→協賛・広告→スタッフ・文章→章・ページ用テキスト。不要なシートは空欄で構いません。'),
      ('3 色と入力範囲', '青タブ＝このガイド（参照用）、緑タブ＝入力用。黄色セルが入力欄。記入例版は薄橙色。濃青の見出しや項目名は編集できません。'),
      ('4 行を記入する', '1行に1件。入力は5〜204行（200件）。アンケートは5行目の1件だけ。基本情報は固定の6項目。使わない行は空欄にします。'),
      ('5 選択欄', 'ポスター要否・広告サイズ・お知らせの種類はセルの▼で選択。ポスターの空欄は「要」。他は必須項目を各シートの案内で確認。'),
      ('6 日付と時刻', '開催日：yyyy-mm-dd（2027-10-24）。企画の時刻：半角24時間HH:MM（09:30、13:15）。開催時間は範囲の文字列（09:30〜16:00）。'),
      ('7 アンケートQR', 'アンケートシートで「アンケートURL」の下の色付きセルに回答用URLを貼付。URLはhttp(s)://で開始。見出し・本文は任意。全欄空なら既存URLを保持。'),
      ('8 保存・取り込み', '保存した.xlsxを、アプリの「掲載情報」→「Excelを読み込む」から選択。認識件数と内容を確認して登録。要確認行は更新／新規／登録しないを明示選択。'),
      ('9 画像と誌面', 'ポスター・広告画像はExcelに埋め込まずアプリで登録。Excelの取り込み後に配置とPDFを確認してください。'),
      ('注意：コピー貼付', '貼り付け操作でExcelの入力規則を上書き・回避できる場合があります。値のみ貼り付け、▼の選択肢と形式を再確認してください。'),
      ('注意：入力の保護', '入力欄だけ編集できます。200件を超える場合は別ファイルに分けて取り込んでください。保護は誤操作防止で、パスワードはありません。'),
      ('注意：互換性', 'シート名と見出し名は変更しないでください。v3も引き続き取り込めます。空欄は既存情報の削除を意味しません。'),
      ('シート一覧／必須・任意', '「掲載する場合」はその情報を載せる場合のみ記入。全シートを埋める必要はありません。'),
    ] + [(f'{i+1:02d} {n}（{GUIDES[n][0]}）', GUIDES[n][1] + ' ' + GUIDES[n][2]) for i,n in enumerate(ORDER)]
    for row in guide: intro.append(row)
    intro.column_dimensions['A'].width = 46; intro.column_dimensions['B'].width = 108
    intro.freeze_panes = 'B2'; intro.sheet_properties.tabColor = '4472C4'
    for row in intro:
        intro.row_dimensions[row[0].row].height = 48
        for c in row:
            c.alignment = Alignment(vertical='center', wrap_text=True)
            c.fill = PatternFill('solid', fgColor=BLUE)
            c.font = Font(name='游ゴシック', size=11, bold=c.column == 1)
    for name in ORDER:
        ws = wb.create_sheet(name); old = source[name]; n = old.max_column
        ws.sheet_properties.tabColor = GREEN; ws.freeze_panes = 'B5'
        for r,text in enumerate([f'※ {name} ｜ {mode}', '※ '+GUIDES[name][1], '※ '+GUIDES[name][2]],1):
            if n>1: ws.merge_cells(start_row=r,start_column=1,end_row=r,end_column=n)
            c=ws.cell(r,1,text); c.alignment=Alignment(wrap_text=True,vertical='center'); c.fill=PatternFill('solid',fgColor=BLUE)
            ws.row_dimensions[r].height=36 if n>2 else 54
        headers=[c.value for c in old[1]]
        for col,h in enumerate(headers,1): ws.cell(4,col,h)
        data=[list(r) for r in old.iter_rows(min_row=2,values_only=True) if any(v is not None for v in r)]
        data=[r for r in data if not str(r[0] or '').startswith('※')]
        if name=='アンケート': data=[[None]*n]
        elif not example:
            data=[[r[0],None] for r in data] if name=='基本情報' else []
        for ri,values in enumerate(data,5):
            for ci,v in enumerate(values,1):
                h=headers[ci-1]
                if v is not None and h in ('開始時刻','終了時刻'):
                    hh,mm=unicodedata.normalize('NFKC',str(v)).split(':'); v=(int(hh)*60+int(mm))/1440
                if h=='広告サイズ' and v is not None: v={'full':'1ページ','half':'1/2ページ','quarter':'1/4ページ'}.get(v,v)
                if name=='基本情報' and ci==2 and values[0]=='開催日' and v:
                    v=datetime.strptime(str(v),'%Y-%m-%d')
                ws.cell(ri,ci,v)
        end=10 if name=='基本情報' else 5 if name=='アンケート' else 204
        for row in ws.iter_rows(min_row=5,max_row=end,max_col=n):
            for c in row:
                locked=name=='基本情報' and c.column==1
                c.protection=Protection(locked=locked)
                c.fill=PatternFill('solid',fgColor=BLUE if locked else ORANGE if example else YELLOW)
                c.alignment=Alignment(wrap_text=True,vertical='top')
                c.font=Font(name='游ゴシック',size=11)
                h=headers[c.column-1]
                if h in ('開始時刻','終了時刻'): c.number_format='hh:mm'
            ws.row_dimensions[row[0].row].height=32
        for ci,h in enumerate(headers,1):
            letter=get_column_letter(ci)
            ws.column_dimensions[letter].width=70 if h in ('本文','本文・項目','アンケートURL','内容') else 28 if h in ('企画名','企業名','会社名','詳細な場所','備考','見出し') else 20
            area=f'{letter}5:{letter}{end}'
            if h=='ポスター要否': rule(ws,'list',area,'"要,不要"')
            if h=='広告サイズ': rule(ws,'list',area,'"1ページ,1/2ページ,1/4ページ"')
            if h=='種類': rule(ws,'list',area,'"お知らせ,注意事項"')
            if h in ('開始時刻','終了時刻'): rule(ws,'time',area,'0','0.99999999')
            if h=='アンケートURL':
                rule(ws,'custom',area,'OR(A5="",AND(LEN(A5)<=2048,OR(LEFT(LOWER(A5),7)="http://",LEFT(LOWER(A5),8)="https://")))')
                ws['A5'].comment=Comment('ここにアンケートの回答用URLを貼り付けます。例：https://example.com/survey\n見出し・本文は任意。URLを消去したい場合はアプリ側で編集してください。','Pamphlet Studio')
                ws.row_dimensions[5].height=80
        if name=='基本情報':
            for ri in range(5,11):
                label=ws.cell(ri,1).value
                if label=='開催日':
                    ws.cell(ri,2).number_format='yyyy-mm-dd'; rule(ws,'date',f'B{ri}','DATE(2000,1,1)','DATE(2100,12,31)')
                if label=='開催回数': rule(ws,'whole',f'B{ri}','1','9999')
        for c in ws[4]:
            c.fill=PatternFill('solid',fgColor=NAVY); c.font=Font(name='游ゴシック',bold=True,color='FFFFFF'); c.alignment=Alignment(wrap_text=True,vertical='center')
        if n == 1: ws.column_dimensions['A'].width = 100
        ws.row_dimensions[4].height=30
        ws.print_title_rows='1:4'
    for ws in wb:
        ws.protection.sheet=True
        ws.protection.selectLockedCells=False; ws.protection.selectUnlockedCells=False
        ws.sheet_view.zoomScale=90
    filename='Pamphlet-Studio-Excel-template-v4'+('-example' if example else '')+'.xlsx'
    path=ROOT/'public/templates'/filename; wb.save(path)
    print(path.relative_to(ROOT))

if __name__=='__main__':
    build(False); build(True)
