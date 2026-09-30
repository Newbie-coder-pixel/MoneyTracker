import { Redis } from '@upstash/redis'
import type { ClientState } from './schedule.js'

export interface PushSubscriptionData {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface ClientRecord extends ClientState {
  subscription: PushSubscriptionData
  createdAt: number
  updatedAt: number
}

/** Personal-use app (PRD §1): a hard cap keeps a leaked URL from filling the free tier. */
export const MAX_CLIENTS = 50

const CLIENTS = 'mt:clients'
const key = (id: string) => `mt:client:${id}`

let redis: Redis | null = null

/** Works with Upstash env names and the Vercel Marketplace (KV_*) names. */
function db(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
    if (!url || !token) throw new Error('Redis is not configured (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)')
    redis = new Redis({ url, token })
  }
  return redis
}

export async function getClient(id: string): Promise<ClientRecord | null> {
  return db().get<ClientRecord>(key(id))
}

export async function putClient(id: string, record: ClientRecord): Promise<void> {
  await db().set(key(id), record)
  await db().sadd(CLIENTS, id)
}

export async function deleteClient(id: string): Promise<void> {
  await db().del(key(id))
  await db().srem(CLIENTS, id)
}

export async function listClientIds(): Promise<string[]> {
  return db().smembers(CLIENTS)
}

export async function clientCount(): Promise<number> {
  return db().scard(CLIENTS)
}
