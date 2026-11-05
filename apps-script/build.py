"""Gera apps-script/index.html a partir de src/pagina.html e src/app.js.

O editor do Apps Script tem dificuldade com arquivos HTML enormes colados de
uma vez, e o HtmlService interpreta alguns trechos de JavaScript. Por isso o
código do app vai embutido em base64 (linhas de 1000 caracteres) dentro de
<script id="app-code" type="text/plain">, e um carregador pequeno o executa.

Uso:  python3 build.py
"""
import base64
from pathlib import Path

aqui = Path(__file__).parent
pagina = (aqui / "src" / "pagina.html").read_text(encoding="utf-8")
codigo = (aqui / "src" / "app.js").read_text(encoding="utf-8")
b64 = base64.b64encode(codigo.encode("utf-8")).decode("ascii")
linhas = "\n".join(b64[i:i + 1000] for i in range(0, len(b64), 1000))
assert pagina.count("@@APP_CODE@@") == 1, "marcador @@APP_CODE@@ não encontrado em src/pagina.html"
(aqui / "index.html").write_text(pagina.replace("@@APP_CODE@@", linhas), encoding="utf-8")
print("index.html gerado:", len(codigo), "caracteres de código")
