import http.server
import socketserver
import webbrowser
import os

PORT = 8000

# Obter o diretório atual onde o script está
web_dir = os.path.dirname(os.path.abspath(__file__))

# Mudar para o diretório web
os.chdir(web_dir)

Handler = http.server.SimpleHTTPRequestHandler

try:
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Servidor iniciado. Acesse: http://localhost:{PORT}")
        webbrowser.open(f"http://localhost:{PORT}")
        httpd.serve_forever()
except Exception as e:
    print(f"Erro ao iniciar o servidor: {e}")
    input("Pressione Enter para sair...")
