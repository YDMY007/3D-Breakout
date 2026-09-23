# -*- coding: utf-8 -*-
"""本地 CONNECT 代理:把发往 github.com:443 的连接转发到可达的 GitHub IP。
用法:python tools/gh_proxy.py [target_ip]
然后:git -c http.proxy=http://127.0.0.1:8443 push ...
SNI/Host 仍是 github.com(客户端行为),证书正常校验;只是 TCP 层落到可达 IP。
"""
import socket
import sys
import threading

LISTEN = ("127.0.0.1", 8443)
TARGET_HOST = "github.com"
TARGET_PORT = 443
FALLBACK_IPS = ["20.27.177.113", "20.200.245.247", "4.237.22.38"]


def pipe(a, b):
    try:
        while True:
            d = a.recv(65536)
            if not d:
                break
            b.sendall(d)
    except Exception:
        pass
    finally:
        for s in (a, b):
            try:
                s.shutdown(socket.SHUT_RDWR)
            except Exception:
                pass
            try:
                s.close()
            except Exception:
                pass


def connect_target():
    ips = [sys.argv[1]] if len(sys.argv) > 1 else FALLBACK_IPS
    last = None
    for ip in ips:
        try:
            return socket.create_connection((ip, TARGET_PORT), timeout=12)
        except Exception as e:
            last = e
    raise last


def handle(client):
    try:
        # 读 CONNECT 请求头
        req = b""
        while b"\r\n\r\n" not in req and len(req) < 8192:
            chunk = client.recv(1024)
            if not chunk:
                client.close()
                return
            req += chunk
        upstream = connect_target()
        client.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        threading.Thread(target=pipe, args=(client, upstream), daemon=True).start()
        threading.Thread(target=pipe, args=(upstream, client), daemon=True).start()
    except Exception:
        try:
            client.sendall(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
        except Exception:
            pass
        client.close()


def main():
    srv = socket.socket()
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(LISTEN)
    srv.listen(64)
    print("CONNECT proxy on %s:%d -> %s:%d (%s)" % (
        LISTEN[0], LISTEN[1], TARGET_HOST, TARGET_PORT,
        sys.argv[1] if len(sys.argv) > 1 else ",".join(FALLBACK_IPS)), flush=True)
    while True:
        c, _ = srv.accept()
        threading.Thread(target=handle, args=(c,), daemon=True).start()


if __name__ == "__main__":
    main()
