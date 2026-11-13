import { randomBytes } from 'crypto';

/**
 * Códigos de un solo uso para entregar la sesión al frontend tras el callback de Google
 * sin poner tokens en la URL: la API redirige con `?code=<ticket>` y el frontend lo
 * canjea con POST /api/auth/google/exchange.
 */
export interface LoginTicketStore<T> {
  create(payload: T): Promise<string>;
  /** Devuelve el contenido y borra el ticket; null si no existe, ya se usó o venció. */
  consume(ticket: string): Promise<T | null>;
}

/**
 * Implementación en memoria (vida corta). Sirve para una sola instancia de la API, que es
 * el despliegue actual en Render. Con varias instancias, moverla a Firestore o Redis.
 */
export class InMemoryLoginTicketStore<T> implements LoginTicketStore<T> {
  private readonly tickets = new Map<string, { payload: T; expiresAt: number }>();

  constructor(
    private readonly ttlMs = 60_000,
    private readonly now: () => number = Date.now
  ) {}

  async create(payload: T): Promise<string> {
    this.sweep();
    const ticket = randomBytes(32).toString('base64url');
    this.tickets.set(ticket, { payload, expiresAt: this.now() + this.ttlMs });
    return ticket;
  }

  async consume(ticket: string): Promise<T | null> {
    const entry = this.tickets.get(ticket);
    if (!entry) return null;
    this.tickets.delete(ticket);
    return entry.expiresAt > this.now() ? entry.payload : null;
  }

  private sweep(): void {
    const now = this.now();
    for (const [ticket, entry] of this.tickets) {
      if (entry.expiresAt <= now) this.tickets.delete(ticket);
    }
  }
}
