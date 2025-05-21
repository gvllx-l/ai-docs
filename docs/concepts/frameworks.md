---
sidebar_position: 7
description: Frameworks para agentes de IA, incluindo LangChain, LlamaIndex, Semantic Kernel, AutoGPT, BabyAGI e comparativos.
---

# Frameworks para Agentes de IA

## O que são Frameworks?

Frameworks são plataformas ou bibliotecas que orquestram agentes, chains, memórias, integrações e ferramentas em aplicações de IA. Eles facilitam a construção, integração e escalabilidade de agentes inteligentes.

## Frameworks Populares

### LangChain
LangChain é um framework para desenvolvimento de aplicações potencializadas por LLMs.

#### Principais Características
- Chains: Composição de múltiplos componentes em sequência
- Agents: Uso de LLMs para escolher ferramentas dinamicamente
- Memory: Diferentes tipos de memória para contexto
- Prompts: Templates e gerenciamento de prompts
- Integrations: Vasta biblioteca de integrações prontas

```typescript
import { ChatOpenAI, OpenAIEmbeddings } from "langchain/chat_models";
import { ConversationChain } from "langchain/chains";
import { BufferMemory } from "langchain/memory";

const chain = new ConversationChain({
  llm: new ChatOpenAI(),
  memory: new BufferMemory(),
});

const response = await chain.call({
  input: "Olá! Como posso ajudar?"
});
```

---

### LlamaIndex
Framework focado em RAG (Retrieval Augmented Generation) e estruturação de dados.

#### Recursos Principais
- Data Connectors: Integração com diversas fontes de dados
- Indexing: Diferentes estratégias de indexação
- Query Engine: Motor de busca e resposta avançado
- Evaluation: Ferramentas para avaliação de respostas

```typescript
import { VectorStoreIndex, Document } from "llamaindex";

const documents = [
  new Document({ text: "Texto para indexar" })
];

const index = await VectorStoreIndex.fromDocuments(documents);
const queryEngine = index.asQueryEngine();

const response = await queryEngine.query(
  "Qual é o conteúdo do texto?"
);
```

---

### Semantic Kernel
Framework da Microsoft para integração de IA em aplicações.

#### Funcionalidades
- Skills: Funções reutilizáveis para tarefas comuns
- Semantic Functions: Funções baseadas em prompts
- Planning: Planejamento automático de tarefas
- Connectors: Integração com serviços Microsoft

```typescript
import { SemanticKernel } from "semantic-kernel";

const kernel = new SemanticKernel();
const skill = kernel.importSkill("skills/writing");

const result = await kernel.runAsync(
  "Escreva um resumo sobre IA",
  skill
);
```

---

### AutoGPT
Framework para agentes autônomos.

#### Características
- Definição de objetivos de alto nível
- Planejamento automático
- Execução autônoma de tarefas
- Memory de longo prazo

---

### BabyAGI
Framework minimalista para agentes.

#### Recursos
- Ciclo de execução simples
- Foco em objetivos
- Decomposição de tarefas
- Priorização automática

---

## Comparativo de Frameworks

| Framework      | Foco Principal | Pontos Fortes                                 | Considerações                  |
|---------------|---------------|-----------------------------------------------|--------------------------------|
| LangChain     | Orquestração   | Ecossistema maduro, integrações, documentação | Complexidade, curva de aprendizado |
| LlamaIndex    | RAG            | Foco em dados, indexação, queries estruturadas| Menos flexível, específico para RAG |
| Semantic Kernel| Empresarial   | Integração Microsoft, skills, planejamento    | Ecossistema menor, mais novo   |
| AutoGPT       | Autonomia      | Agentes autônomos, objetivos de alto nível    | Menos controle, experimental   |
| BabyAGI       | Minimalista    | Simplicidade, foco em objetivos               | Poucos recursos, experimental  |

---

## Exemplos de Integração entre Frameworks

### LangChain + LlamaIndex
```typescript
import { ChatOpenAI } from "langchain/chat_models";
import { VectorStoreIndex, Document } from "llamaindex";

// Criar índice com LlamaIndex
const documents = [
  new Document({ text: "Dados para indexar" })
];
const index = await VectorStoreIndex.fromDocuments(documents);

// Usar com LangChain
const chain = new ConversationChain({
  llm: new ChatOpenAI(),
  memory: new VectorStoreMemory({
    vectorStore: index.asRetriever()
  }),
});

const response = await chain.call({
  input: "Analise os dados indexados"
});
```

### Semantic Kernel + LangChain
```typescript
import { SemanticKernel } from "semantic-kernel";
import { Tool } from "langchain/tools";

// Criar skill no Semantic Kernel
const kernel = new SemanticKernel();
const skill = kernel.importSkill("skills/analysis");

// Usar como ferramenta no LangChain
class SemanticKernelTool extends Tool {
  name = "semantic_kernel";
  description = "Executa skills do Semantic Kernel";

  async _call(input: string) {
    return await kernel.runAsync(input, skill);
  }
}
```

---

## Recursos Adicionais
- [Documentação LangChain](https://js.langchain.com/docs)
- [Documentação LlamaIndex](https://docs.llamaindex.ai)
- [Documentação Semantic Kernel](https://learn.microsoft.com/semantic-kernel) 