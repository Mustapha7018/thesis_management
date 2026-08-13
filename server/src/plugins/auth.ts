/**
 * Authentication + authorisation (FR-AUTH-03/04): JWT verification runs on
 * EVERY route unless the route opts out with `config: { public: true }` —
 * deny by default. Role checks are per-route preHandlers; "self" routes
 * additionally match the token's ref_id against the path parameter.
 */
import fastifyJwt from "@fastify/jwt"
import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify"
import fp from "fastify-plugin"
import { config } from "../config.js"
import { forbidden, unauthorized } from "../lib/errors.js"

export type Role = "student" | "supervisor" | "admin"

export interface TokenClaims {
  sub: string
  role: Role
  ref_id: number | null
  email: string
  display_name: string
  /** Set only on long-lived calendar-feed tokens (see meetings module). */
  feed?: boolean
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: TokenClaims
    user: TokenClaims
  }
}

declare module "fastify" {
  interface FastifyContextConfig {
    public?: boolean
  }
}

async function authPlugin(app: FastifyInstance) {
  await app.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_TTL },
  })

  app.addHook("onRequest", async (req) => {
    // Auth guards the versioned API only; static SPA assets, /health and
    // /api/docs are outside it. Deny by default within /api/v1.
    if (!req.url.startsWith("/api/v1")) return
    if (req.routeOptions.config?.public) return
    try {
      await req.jwtVerify()
    } catch {
      throw unauthorized("Missing, invalid or expired token.")
    }
  })
}

export const auth = fp(authPlugin)

/** Route preHandler: token role must be one of the given roles (403 otherwise). */
export function requireRole(...roles: Role[]): preHandlerHookHandler {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    if (!roles.includes(req.user.role)) {
      throw forbidden()
    }
  }
}

/**
 * The caller must be the resource owner (matching ref_id for the given role)
 * or hold one of the extra roles (usually "admin").
 */
export function assertSelfOr(req: FastifyRequest, ownerRole: Role, ownerRefId: number, extraRoles: Role[] = ["admin"]) {
  const user = req.user
  if (user.role === ownerRole && user.ref_id === ownerRefId) return
  if (extraRoles.includes(user.role)) return
  throw forbidden()
}
