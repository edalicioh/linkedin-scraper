FROM mcr.microsoft.com/playwright:v1.63.0-noble

ENV NODE_ENV=production \
    HEADLESS=true \
    PORT=3000

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=pwuser:pwuser . .
RUN mkdir -p /app/storage && chown -R pwuser:pwuser /app/storage

USER pwuser

EXPOSE 3000

CMD ["npm", "run", "start:api"]
