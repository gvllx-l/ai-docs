---
sidebar_position: 1
description: Comparativo detalhado dos principais bancos de dados vetoriais disponíveis no mercado.
---

# Bancos de Dados Vetoriais

## MongoDB Atlas

### Visão Geral
MongoDB Atlas oferece suporte nativo para busca vetorial através do Atlas Vector Search.

### Características
- **Tipo**: Cloud/Híbrido
- **Dimensões Máximas**: 2048
- **Algoritmos**: HNSW, IVF
- **Linguagens Suportadas**: Todas as drivers oficiais MongoDB

### Pontos Fortes
- Integração com dados existentes
- Fácil de escalar
- Bom custo-benefício
- Suporte a JSON nativo
- Backups automáticos

### Exemplo de Uso

```typescript
import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();

const collection = client.db('vectordb').collection('embeddings');

// Criar índice vetorial
await collection.createIndex({
  embedding: {
    type: "vectorSearch"
  }
});

// Buscar documentos similares
const results = await collection.aggregate([
  {
    $vectorSearch: {
      queryVector: [0.1, 0.2, ...],
      path: "embedding",
      numCandidates: 100,
      limit: 10
    }
  }
]).toArray();
```

## Pinecone

### Visão Geral
Pinecone é um banco de dados vetorial nativo em cloud, otimizado para buscas em larga escala.

### Características
- **Tipo**: Cloud
- **Dimensões Máximas**: 20000
- **Algoritmos**: HNSW
- **Linguagens**: Python, Node.js, Java, Go

### Pontos Fortes
- Alta performance
- Fácil de usar
- Boa documentação
- Escalabilidade automática
- Baixa latência

### Exemplo de Uso

```typescript
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const index = pinecone.index('my-index');

// Upsert vetores
await index.upsert([{
  id: '1',
  values: [0.1, 0.2, ...],
  metadata: { text: 'documento' }
}]);

// Buscar similares
const results = await index.query({
  vector: [0.1, 0.2, ...],
  topK: 10,
  includeMetadata: true
});
```

## Supabase

### Visão Geral
Supabase oferece busca vetorial através do pgvector no PostgreSQL.

### Características
- **Tipo**: Cloud/Self-hosted
- **Dimensões**: Ilimitado (prático até ~2000)
- **Algoritmos**: IVF, HNSW
- **Linguagens**: Todas com suporte PostgreSQL

### Pontos Fortes
- PostgreSQL com pgvector
- Stack completa
- Bom preço
- Interface visual
- Autenticação integrada

### Exemplo de Uso

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Inserir embeddings
await supabase
  .from('documents')
  .insert({
    content: 'texto',
    embedding: [0.1, 0.2, ...]
  });

// Buscar similares
const { data } = await supabase
  .rpc('match_documents', {
    query_embedding: [0.1, 0.2, ...],
    match_threshold: 0.8,
    match_count: 10
  });
```

## Milvus

### Visão Geral
Milvus é um banco de dados vetorial open-source altamente performático.

### Características
- **Tipo**: Self-hosted
- **Dimensões**: Ilimitado
- **Algoritmos**: HNSW, IVF, FLAT, ANNOY
- **Linguagens**: Python, Node.js, Java, Go

### Pontos Fortes
- Alta performance
- Muito customizável
- Open source
- Suporte a GPU
- Múltiplos índices

### Exemplo de Uso

```typescript
import { MilvusClient } from '@zilliz/milvus2-sdk-node';

const client = new MilvusClient({
  address: 'localhost:19530'
});

// Criar coleção
await client.createCollection({
  collection_name: 'documents',
  fields: [
    {
      name: 'id',
      data_type: DataType.Int64,
      is_primary_key: true,
    },
    {
      name: 'embedding',
      data_type: DataType.FloatVector,
      dim: 1536
    }
  ]
});

// Buscar similares
const results = await client.search({
  collection_name: 'documents',
  vector: [0.1, 0.2, ...],
  limit: 10
});
```

## Qdrant

### Visão Geral
Qdrant é um banco de dados vetorial moderno com foco em filtros e performance.

### Características
- **Tipo**: Self-hosted/Cloud
- **Dimensões**: Ilimitado
- **Algoritmos**: HNSW
- **Linguagens**: Python, Rust, Node.js

### Pontos Fortes
- Rápido
- Filtros avançados
- Boa documentação
- API REST nativa
- Payload flexível

### Exemplo de Uso

```typescript
import { QdrantClient } from '@qdrant/qdrant-js';

const client = new QdrantClient({
  url: 'http://localhost:6333'
});

// Inserir pontos
await client.upsert('collection_name', {
  points: [{
    id: 1,
    vector: [0.1, 0.2, ...],
    payload: { text: 'documento' }
  }]
});

// Buscar similares
const results = await client.search('collection_name', {
  vector: [0.1, 0.2, ...],
  limit: 10
});
```

## Comparativo de Performance

| Provider | Latência (p95) | Throughput | Escalabilidade |
|----------|---------------|------------|----------------|
| MongoDB Atlas | ~50ms | Alta | Automática |
| Pinecone | ~20ms | Muito Alta | Automática |
| Supabase | ~100ms | Média | Manual |
| Milvus | ~10ms | Muito Alta | Manual |
| Qdrant | ~15ms | Alta | Manual |

## Custos Estimados

| Provider | Plano Básico | Plano Business | Enterprise |
|----------|-------------|----------------|------------|
| MongoDB Atlas | Grátis | $0.10/hora | Customizado |
| Pinecone | $0.05/hora | $0.15/hora | Customizado |
| Supabase | Grátis | $25/mês | Customizado |
| Milvus | Self-hosted | Self-hosted | Self-hosted |
| Qdrant | Self-hosted | $0.12/hora | Customizado |

## Escolhendo o Provider Ideal

### Considere:

1. **Volume de Dados**
   - Quantidade de vetores
   - Tamanho dos metadados
   - Taxa de crescimento

2. **Requisitos de Performance**
   - Latência máxima aceitável
   - Throughput necessário
   - Consistência vs disponibilidade

3. **Operacional**
   - Expertise da equipe
   - Recursos de infraestrutura
   - Necessidade de backups

4. **Custos**
   - Orçamento disponível
   - Previsibilidade de custos
   - TCO (Total Cost of Ownership) 