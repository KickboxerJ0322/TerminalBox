FROM python:3.13-alpine
WORKDIR /app
COPY --chown=nobody:nobody server.py ./server.py
USER nobody
EXPOSE 3100 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD python3 -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('CHALLENGE_HTTP_PORT', '3100') + '/api/status', timeout=3)"
CMD ["python3", "server.py"]
