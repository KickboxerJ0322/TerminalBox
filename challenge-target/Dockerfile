FROM python:3.13-alpine
WORKDIR /app
COPY --chown=nobody:nobody server.py ./server.py
USER nobody
EXPOSE 3100 4100
CMD ["python3", "server.py"]
