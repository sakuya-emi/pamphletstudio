"""PDF構造・テキストの追加検証。pip install pypdf 後に実行。"""
from pathlib import Path
from pypdf import PdfReader
r=PdfReader('output/pdf/verification.pdf')
assert len(r.pages)%2==0
for p in r.pages:
 assert abs(float(p.mediabox.width)-148*72/25.4)<.01
 assert abs(float(p.mediabox.height)-210*72/25.4)<.01
text='\n'.join(p.extract_text() for p in r.pages)
for word in ['第27回','稲友祭','企画一覧','学生企画','VECTOR POSTER']:
 assert word in text,word
fonts=set();forms=0;images=0
seen=set()
def visit(resources):
 global forms,images
 resources=resources.get_object()
 for ref in resources.get('/Font',{}).values():
  f=ref.get_object();name=str(f.get('/BaseFont'));fonts.add(name)
  if 'Noto' in name:
   desc=f.get('/DescendantFonts',[f])[0].get_object().get('/FontDescriptor').get_object()
   assert any(key in desc for key in ['/FontFile','/FontFile2','/FontFile3']),name
 for ref in resources.get('/XObject',{}).values():
  key=str(ref)
  if key in seen: continue
  seen.add(key);o=ref.get_object()
  if o.get('/Subtype')=='/Form':
   forms+=1
   assert b' re' in o.get_data() or b'BT' in o.get_data()
   if '/Resources' in o: visit(o['/Resources'])
  elif o.get('/Subtype')=='/Image':images+=1
for p in r.pages:visit(p['/Resources'])
assert forms>0
assert images==0,'Vector fixture must not be rasterized'
Path('docs/pdf-verification.txt').write_text(f'Pages: {len(r.pages)}\nAll A5: PASS\nJapanese text extraction: PASS\nNoto embedding: PASS\nEmbedded PDF Form XObjects: {forms}\nRaster image XObjects: {images}\nFonts: {", ".join(sorted(fonts))}\n')
print(Path('docs/pdf-verification.txt').read_text())
