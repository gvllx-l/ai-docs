---
sidebar_position: 3
description: Comparativo dos principais sistemas de memória para chat e IA generativa.
---

# Sistemas de Memória

## Visão Geral
Sistemas de memória armazenam o histórico de conversas, contexto e dados temporários em aplicações de IA. A escolha do sistema impacta performance, escalabilidade e custo.

## Comparativo de Sistemas

| Sistema     | Tipo   | Pontos Fortes                        | Considerações           |
|-------------|--------|--------------------------------------|------------------------|
| MongoDB     | NoSQL  | Flexível, escalável, bom para JSON   | Overhead, complexidade |
| PostgreSQL  | SQL    | Estruturado, transacional, confiável | Performance, rigidez   |
| Redis       | Cache  | Ultra rápido, simples, TTL nativo    | Volatilidade, tamanho  |

---

## MongoDB

### Visão Geral
Banco NoSQL flexível, ótimo para armazenar históricos de chat em formato JSON.

### Exemplo de Uso
```typescript
class MongoMemoryStore implements MemoryStore {
  constructor(private collection: Collection) {}
  async addMessage(sessionId: string, message: ChatMessage): Promise<void> {
    await this.collection.updateOne(
      { sessionId },
      { 
        $push: { messages: message },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
  }
  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const session = await this.collection.findOne({ sessionId });
    return session?.messages || [];
  }
}
```

---

## PostgreSQL

### Visão Geral
Banco relacional robusto, ideal para times que já usam SQL e precisam de transações.

### Exemplo de Uso
```typescript
class PostgresMemoryStore implements MemoryStore {
  constructor(private pool: Pool) {}
  async addMessage(sessionId: string, message: ChatMessage): Promise<void> {
    await this.pool.query(
      'INSERT INTO chat_memory (session_id, message, created_at) VALUES ($1, $2, NOW())',
      [sessionId, JSON.stringify(message)]
    );
  }
  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const res = await this.pool.query(
      'SELECT message FROM chat_memory WHERE session_id = $1 ORDER BY created_at ASC',
      [sessionId]
    );
    return res.rows.map(r => JSON.parse(r.message));
  }
}
```

---

## Redis

### Visão Geral
Cache em memória, ultra rápido, ideal para sessões temporárias e TTL automático.

### Exemplo de Uso
```typescript
class RedisMemoryStore implements MemoryStore {
  constructor(
    private redis: Redis,
    private ttl: number = 24 * 60 * 60 // 24 horas
  ) {}
  async addMessage(sessionId: string, message: ChatMessage): Promise<void> {
    const key = `chat:${sessionId}`;
    await this.redis.rpush(key, JSON.stringify(message));
    await this.redis.expire(key, this.ttl);
  }
  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const key = `chat:${sessionId}`;
    const messages = await this.redis.lrange(key, 0, -1);
    return messages.map(m => JSON.parse(m));
  }
}
``` 