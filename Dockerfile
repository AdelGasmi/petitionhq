FROM node:20-alpine AS base
WORKDIR /app

# Dependencies layer — separate from build so Docker layer cache is preserved
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Build layer — needs devDependencies for tsc/next build
FROM base AS builder
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Cache-bust: GIT_SHA changes every commit, forcing this RUN — and therefore the
# source COPY + build below — to re-run. Without it, BuildKit can wrongly
# cache-hit the COPY layer and silently ship a stale bundle. npm ci is ABOVE this
# line, so dependency installs stay cached (deploys remain fast).
ARG GIT_SHA=unknown
RUN echo "source build for commit ${GIT_SHA}"
COPY . .

# NEXT_PUBLIC_* vars must be available at build time — Next.js inlines them
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY

# Generate Prisma client before build
RUN npx prisma generate
RUN npm run build

# Production image — copy only what's needed
FROM base AS runner
RUN apk add --no-cache libc6-compat openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Static assets in public/ — standalone output does NOT bundle these, so they
# must be copied explicitly or /favicon.ico, /og-default.png, etc. 404 in prod.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Prisma client + CLI + schema (client needed at runtime, CLI needed for migrate deploy)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
RUN mkdir -p /app/node_modules/.bin && ln -sf ../prisma/build/index.js /app/node_modules/.bin/prisma
COPY --from=builder /app/prisma ./prisma
# Form drafting guides (read at runtime by brief/letter routes)
COPY --from=builder /app/guides ./guides
# USCIS PDF form templates (read at runtime by /api/cases/[id]/pdf)
COPY --from=builder /app/assets/pdf-templates ./assets/pdf-templates

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
