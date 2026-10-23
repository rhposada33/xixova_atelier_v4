FROM node:22-bookworm-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d
WORKDIR /app/mail-worker
COPY mail-worker/package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY mail-worker/*.mjs ./
COPY supabase/functions/_shared/mail-crypto.mjs /app/supabase/functions/_shared/mail-crypto.mjs
USER node
CMD ["node","main.mjs"]
