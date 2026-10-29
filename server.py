#!/usr/bin/env python3
"""
Local HTTP Server for "AI-Based Voice Command Recognition for Assistive Robotic Systems"
College Engineering Research Project Demonstration
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class RoboticsHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS and disable aggressive caching for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

def main():
    os.chdir(DIRECTORY)
    handler = RoboticsHTTPRequestHandler

    # Allow port reuse
    socketserver.TCPServer.allow_reuse_address = True

    try:
        with socketserver.TCPServer(("", PORT), handler) as httpd:
            url = f"http://localhost:{PORT}"
            print("=" * 72)
            print("  AI-BASED VOICE COMMAND RECOGNITION FOR ASSISTIVE ROBOTIC SYSTEMS")
            print("  College Engineering Research Project Demonstration Server")
            print("=" * 72)
            print(f"  [+] Local Simulation Server running at: {url}")
            print(f"  [+] Root Directory: {DIRECTORY}")
            print("  [+] Microphone / Web Speech API requires http://localhost or HTTPS.")
            print("  [+] Press Ctrl+C to terminate server.")
            print("=" * 72)

            # Auto-open browser
            try:
                webbrowser.open(url)
            except Exception as e:
                print(f"  [!] Note: Please open {url} manually in your browser: {e}")

            httpd.serve_forever()

    except OSError as e:
        if e.errno == 98 or e.errno == 10048:
            alt_port = 8080
            print(f"  [!] Port {PORT} is in use, attempting fallback to port {alt_port}...")
            with socketserver.TCPServer(("", alt_port), handler) as httpd:
                url = f"http://localhost:{alt_port}"
                print(f"  [+] Server running at: {url}")
                webbrowser.open(url)
                httpd.serve_forever()
        else:
            print(f"  [ERROR] Server failed to start: {e}")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n  [+] Server shut down gracefully.")
        sys.exit(0)

if __name__ == '__main__':
    main()
