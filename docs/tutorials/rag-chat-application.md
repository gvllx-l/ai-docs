---
sidebar_position: 2
---

# Desenvolvendo um Chat com RAG

Este tutorial estende a aplicação RAG anterior para criar uma experiência de chat completa.

## Pré-requisitos

- Aplicação RAG básica (do tutorial anterior)
- Conhecimento básico de React (para frontend)
- Node.js e TypeScript

## Etapa 1: Melhorando a Memória de Chat

Vamos aprimorar o serviço de chat memory para suportar mais recursos:

```typescript
// src/services/enhancedChatMemory.ts
import { RedisClientType } from 'redis';
import { ChatMessage } from '../models/chat';
import { openai } from '../config/openai';

export class EnhancedChatMemory {
  private prefix: string = 'chat:';
  private summaryPrefix: string = 'summary:';
  
  constructor(
    private redis: RedisClientType,
    private maxMessagesPerContext = 10
  ) {}
  
  async addMessage(sessionId: string, message: ChatMessage): Promise<void> {
    const key = `${this.prefix}${sessionId}`;
    
    // Adicionar timestamp se não existir
    const messageWithTime: ChatMessage = {
      ...message,
      timestamp: message.timestamp || new Date()
    };
    
    await this.redis.rPush(key, JSON.stringify(messageWithTime));
    await this.redis.expire(key, 24 * 60 * 60); // 24h TTL
    
    // Atualizar contador de mensagens
    const count = await this.redis.lLen(key);
    
    // Se temos muitas mensagens, criar/atualizar resumo
    if (count % 20 === 0) {
      await this.updateSummary(sessionId);
    }
  }
  
  async getMessages(sessionId: string, limit?: number): Promise<ChatMessage[]> {
    const key = `${this.prefix}${sessionId}`;
    const count = await this.redis.lLen(key);
    
    // Determinar quantas mensagens obter
    const messagesToGet = limit ? Math.min(limit, count) : count;
    const startIdx = count - messagesToGet;
    
    const messages = await this.redis.lRange(key, startIdx, -1);
    return messages.map(m => JSON.parse(m));
  }
  
  async getContextForPrompt(sessionId: string): Promise<string> {
    // Obter resumo, se existir
    const summaryKey = `${this.summaryPrefix}${sessionId}`;
    const summary = await this.redis.get(summaryKey);
    
    // Obter mensagens recentes
    const recentMessages = await this.getMessages(sessionId, this.maxMessagesPerContext);
    const messageText = recentMessages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');
    
    if (summary) {
      return `
        Conversation Summary:
        ${summary}
        
        Recent Messages:
        ${messageText}
      `;
    }
    
    return `Conversation History:\n${messageText}`;
  }
  
  private async updateSummary(sessionId: string): Promise<void> {
    const key = `${this.prefix}${sessionId}`;
    const summaryKey = `${this.summaryPrefix}${sessionId}`;
    
    // Obter todas as mensagens exceto as últimas 10
    const count = await this.redis.lLen(key);
    const messagesToSummarize = await this.redis.lRange(key, 0, count - this.maxMessagesPerContext - 1);
    
    if (messagesToSummarize.length === 0) {
      return;
    }
    
    // Formatar mensagens para summarização
    const messageText = messagesToSummarize
      .map(m => {
        const msg = JSON.parse(m);
        return `${msg.role}: ${msg.content}`;
      })
      .join('\n');
    
    // Obter resumo existente
    const existingSummary = await this.redis.get(summaryKey);
    
    // Criar prompt para resumo
    let prompt = 'Summarize the following conversation in a concise paragraph:';
    
    if (existingSummary) {
      prompt = `
        Previous summary:
        ${existingSummary}
        
        New conversation to integrate into the summary:
        ${messageText}
        
        Provide an updated, concise summary of the entire conversation.
      `;
    } else {
      prompt = `
        Summarize the following conversation in a concise paragraph:
        ${messageText}
      `;
    }
    
    // Gerar resumo
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant that summarizes conversations." },
        { role: "user", content: prompt }
      ],
      max_tokens: 300
    });
    
    const summary = completion.choices[0].message.content;
    
    // Salvar resumo
    await this.redis.set(summaryKey, summary);
    await this.redis.expire(summaryKey, 24 * 60 * 60); // 24h TTL
    
    // Opcionalmente, remover mensagens antigas para economizar espaço
    if (count > 100) {
      await this.redis.lTrim(key, count - 50, -1);
    }
  }
  
  async clearSession(sessionId: string): Promise<void> {
    const key = `${this.prefix}${sessionId}`;
    const summaryKey = `${this.summaryPrefix}${sessionId}`;
    
    await this.redis.del(key);
    await this.redis.del(summaryKey);
  }
}
```

## Etapa 2: Aprimorando o Serviço RAG para Chat
Modificando o RAG para suportar experiência de chat:

```typescript
// src/services/enhancedRagService.ts
import { VectorStore } from './vectorStoreService';
import { EnhancedChatMemory } from './enhancedChatMemory';
import { openai } from '../config/openai';
import { QueryResult } from '../models/query';
import { ChatMessage } from '../models/chat';

export class EnhancedRagService {
  constructor(
    private vectorStore: VectorStore,
    private chatMemory: EnhancedChatMemory,
    private systemPrompt: string = "You are a helpful assistant."
  ) {}
  
  async query(question: string, sessionId: string): Promise<QueryResult> {
    // 1. Buscar documentos relevantes
    const relevantDocs = await this.vectorStore.search(question, 3);
    
    // 2. Obter contexto da conversa (resumo + mensagens recentes)
    const conversationContext = await this.chatMemory.getContextForPrompt(sessionId);
    
    // 3. Gerar resposta
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `${this.systemPrompt}
            
            When responding, use the following information:
            
            ${relevantDocs.map(doc => doc.content).join('\n\n')}
            
            ${conversationContext}
          `
        },
        { role: "user", content: question }
      ],
    });
    
    const answer = completion.choices[0].message.content;
    
    // 4. Salvar na memória
    await this.chatMemory.addMessage(sessionId, { role: 'user', content: question });
    await this.chatMemory.addMessage(sessionId, { role: 'assistant', content: answer });
    
    return {
      answer,
      sources: relevantDocs
    };
  }
  
  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    return await this.chatMemory.getMessages(sessionId);
  }
  
  async clearChat(sessionId: string): Promise<void> {
    await this.chatMemory.clearSession(sessionId);
  }
}
```

## Etapa 3: Adicionando Controladores de Chat
Criar controladores específicos para a interface de chat:

```typescript
// src/controllers/chatController.ts
import { Request, Response } from 'express';
import { EnhancedRagService } from '../services/enhancedRagService';
import { v4 as uuidv4 } from 'uuid';

export class ChatController {
  constructor(private ragService: EnhancedRagService) {}
  
  async sendMessage(req: Request, res: Response) {
    try {
      const { message, sessionId } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }
      
      // Usar sessionId fornecido ou gerar um novo
      const chatSessionId = sessionId || uuidv4();
      
      const result = await this.ragService.query(message, chatSessionId);
      
      res.json({
        message: result.answer,
        sources: result.sources,
        sessionId: chatSessionId
      });
    } catch (error) {
      console.error('Error processing message:', error);
      res.status(500).json({ error: 'Failed to process message' });
    }
  }
  
  async getChatHistory(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      const history = await this.ragService.getChatHistory(sessionId);
      
      res.json({ history });
    } catch (error) {
      console.error('Error retrieving chat history:', error);
      res.status(500).json({ error: 'Failed to retrieve chat history' });
    }
  }
  
  async clearChat(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      await this.ragService.clearChat(sessionId);
      
      res.json({ success: true, message: 'Chat history cleared' });
    } catch (error) {
      console.error('Error clearing chat:', error);
      res.status(500).json({ error: 'Failed to clear chat' });
    }
  }
}
```

## Etapa 4: Adicionando Rotas de Chat
Configurando as rotas específicas para o chat:

```typescript
// src/routes/chatRoutes.ts
import { Router } from 'express';
import { ChatController } from '../controllers/chatController';
import { EnhancedRagService } from '../services/enhancedRagService';

export function createChatRouter(ragService: EnhancedRagService): Router {
  const router = Router();
  const controller = new ChatController(ragService);
  
  router.post('/message', (req, res) => controller.sendMessage(req, res));
  router.get('/history/:sessionId', (req, res) => controller.getChatHistory(req, res));
  router.delete('/history/:sessionId', (req, res) => controller.clearChat(req, res));
  
  return router;
}
```

## Etapa 5: Atualizando o Servidor Principal
Modificando o arquivo principal para incluir as novas funcionalidades:

```typescript
// src/index.ts (versão atualizada)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectToDatabase } from './config/database';
import { connectToRedis } from './config/redis';
import { VectorStore } from './services/vectorStoreService';
import { EnhancedChatMemory } from './services/enhancedChatMemory';
import { EnhancedRagService } from './services/enhancedRagService';
import { createDocumentRouter } from './routes/documentRoutes';
import { createQueryRouter } from './routes/queryRoutes';
import { createChatRouter } from './routes/chatRoutes';

dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  const app = express();
  
  // Middlewares
  app.use(cors());
  app.use(express.json());
  
  // Conexões
  const db = await connectToDatabase();
  const redis = await connectToRedis();
  
  // Serviços
  const vectorStore = new VectorStore(db);
  await vectorStore.initialize();
  
  const chatMemory = new EnhancedChatMemory(redis);
  
  const systemPrompt = `
    You are a helpful assistant that answers questions based on the provided context.
    If the answer is not in the context, say that you don't know but try to be helpful.
    Be conversational and engaging while maintaining accuracy.
    Prefer concise answers unless the user asks for details.
  `;
  
  const ragService = new EnhancedRagService(vectorStore, chatMemory, systemPrompt);
  
  // Rotas
  app.use('/api/documents', createDocumentRouter(vectorStore));
  app.use('/api/query', createQueryRouter(ragService));
  app.use('/api/chat', createChatRouter(ragService));
  
  // Servir frontend
  app.use(express.static('public'));
  
  // Rota de saúde
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
  });
  
  // Iniciar servidor
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(console.error);
```

## Etapa 6: Criando o Frontend de Chat
Agora vamos criar um frontend simples usando React:

```bash
# Criar diretório para o frontend
mkdir -p public/js
```

Para desenvolvimento real, você usaria create-react-app ou Vite

Criar o arquivo HTML base:

```html
<!-- public/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RAG Chat Application</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <div id="root"></div>
  
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/babel-standalone@6/babel.min.js"></script>
  <script type="text/babel" src="/js/app.js"></script>
</body>
</html>
```

Criar estilos básicos:

```css
/* public/css/styles.css */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  margin: 0;
  padding: 0;
  background-color: #f5f8fa;
}

.chat-container {
  max-width: 1000px;
  margin: 2rem auto;
  background: white;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  height: 80vh;
}

.chat-header {
  padding: 1rem;
  border-bottom: 1px solid #e1e8ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
}

.message {
  padding: 0.75rem 1rem;
  border-radius: 18px;
  margin-bottom: 0.5rem;
  max-width: 75%;
  position: relative;
}

.user-message {
  background-color: #1da1f2;
  color: white;
  align-self: flex-end;
  border-bottom-right-radius: 4px;
}

.assistant-message {
  background-color: #e1e8ed;
  color: #14171a;
  align-self: flex-start;
  border-bottom-left-radius: 4px;
}

.message-time {
  font-size: 0.7rem;
  opacity: 0.7;
  margin-top: 0.25rem;
  text-align: right;
}

.sources-container {
  font-size: 0.8rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed rgba(0, 0, 0, 0.1);
}

.chat-input-container {
  padding: 1rem;
  border-top: 1px solid #e1e8ed;
}

.chat-input-form {
  display: flex;
  gap: 0.5rem;
}

.chat-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 20px;
  border: 1px solid #e1e8ed;
  outline: none;
}

.chat-input:focus {
  border-color: #1da1f2;
}

.send-button {
  padding: 0.75rem 1.5rem;
  background-color: #1da1f2;
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
}

.send-button:hover {
  background-color: #1a91da;
}

.send-button:disabled {
  background-color: #9ad0f5;
  cursor: not-allowed;
}

.clear-button {
  padding: 0.5rem 1rem;
  background-color: #e1e8ed;
  color: #657786;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  font-size: 0.85rem;
}

.clear-button:hover {
  background-color: #ccd6dd;
}

.loading {
  display: flex;
  padding: 1rem;
  justify-content: center;
  color: #657786;
}

.dot-typing {
  position: relative;
  left: -9999px;
  width: 10px;
  height: 10px;
  border-radius: 5px;
  background-color: #657786;
  color: #657786;
  box-shadow: 9984px 0 0 0 #657786, 9999px 0 0 0 #657786, 10014px 0 0 0 #657786;
  animation: dot-typing 1.5s infinite linear;
}

@keyframes dot-typing {
  0% {
    box-shadow: 9984px 0 0 0 #657786, 9999px 0 0 0 #657786, 10014px 0 0 0 #657786;
  }
  16.667% {
    box-shadow: 9984px -10px 0 0 #657786, 9999px 0 0 0 #657786, 10014px 0 0 0 #657786;
  }
  33.333% {
    box-shadow: 9984px 0 0 0 #657786, 9999px 0 0 0 #657786, 10014px 0 0 0 #657786;
  }
  50% {
    box-shadow: 9984px 0 0 0 #657786, 9999px -10px 0 0 #657786, 10014px 0 0 0 #657786;
  }
  66.667% {
    box-shadow: 9984px 0 0 0 #657786, 9999px 0 0 0 #657786, 10014px 0 0 0 #657786;
  }
  83.333% {
    box-shadow: 9984px 0 0 0 #657786, 9999px 0 0 0 #657786, 10014px -10px 0 0 #657786;
  }
  100% {
    box-shadow: 9984px 0 0 0 #657786, 9999px 0 0 0 #657786, 10014px 0 0 0 #657786;
  }
}
```

Criar o componente React:

```jsx
/* public/js/app.js */
function App() {
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [sessionId, setSessionId] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const messagesEndRef = React.useRef(null);

  React.useEffect(() => {
    // Gerar um ID de sessão na primeira carga
    if (!sessionId) {
      setSessionId(generateSessionId());
    }
    
    // Rolar para a última mensagem
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  const generateSessionId = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };
  
  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: input,
          sessionId
        })
      });
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      const data = await response.json();
      
      const assistantMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
        sources: data.sources
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Adicionar mensagem de erro
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClearChat = async () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
      try {
        await fetch(`/api/chat/history/${sessionId}`, {
          method: 'DELETE'
        });
        
        setMessages([]);
        // Gerar novo ID de sessão
        setSessionId(generateSessionId());
      } catch (error) {
        console.error('Error clearing chat:', error);
      }
    }
  };
  
  return (
    <div className="container mt-4">
      <div className="chat-container">
        <div className="chat-header">
          <h2>RAG Chat Application</h2>
          <button 
            className="clear-button"
            onClick={handleClearChat}
            disabled={isLoading || messages.length === 0}
          >
            Clear Chat
          </button>
        </div>
        
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="text-center text-muted p-4">
              Start a conversation by sending a message
            </div>
          )}
          
          {messages.map((message, index) => (
            <div 
              key={index}
              className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
            >
              <div>{message.content}</div>
              <div className="message-time">{formatTime(message.timestamp)}</div>
              
              {message.sources && message.sources.length > 0 && (
                <div className="sources-container">
                  <strong>Sources:</strong>
                  <ul className="ps-3 mb-0">
                    {message.sources.slice(0, 2).map((source, idx) => (
                      <li key={idx}>{source.metadata?.title || 'Document'}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="loading">
              <div className="dot-typing"></div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        <div className="chat-input-container">
          <form className="chat-input-form" onSubmit={handleSubmit}>
            <input
              type="text"
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
            />
            <button 
              type="submit" 
              className="send-button"
              disabled={isLoading || !input.trim()}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
```

## Etapa 7: Testando a Aplicação de Chat
Executar a aplicação e testar:

```bash
# Executar o servidor
npm run dev

# Acessar no navegador
# http://localhost:3000
```

## Etapa 8: Melhorias para Produção
Para uma aplicação em produção, considere:

1. Autenticação e Autorização:

```typescript
// Exemplo básico de middleware de autenticação
function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

// Usar em rotas que exigem autenticação
app.use('/api/documents', authMiddleware, createDocumentRouter(vectorStore));
```

2. Rate Limiting:

```typescript
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requisições por janela
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);
```

3. Monitoramento e Logging:

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'chat-service' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Middleware de logging
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    });
  });
  
  next();
});
```

4. Implementação Mais Robusta do Frontend:
Para uma aplicação em produção, considere usar:
- Next.js ou Create React App para o frontend
- State management (Redux, Context API)
- TypeScript no frontend
- Testes E2E com Cypress
- CI/CD para deploys automáticos

## Conclusão
Com este tutorial, você construiu uma aplicação de chat completa com RAG, incorporando:
- Memória de chat aprimorada
- Experiência conversacional
- Interface de usuário amigável
- Melhorias para produção

Este fluxo cobre todos os tópicos importantes:
- Banco de dados vetorial (MongoDB com Vector Search)
- Embeddings (OpenAI)
- Chat memory (Redis)
- RAG (Retrieval com base de conhecimento)
- Instruções para o LLM (system prompt)

O resultado é um sistema conversacional que combina contextual awareness (memória) com conhecimento factual (RAG), criando uma experiência poderosa e útil para os usuários.

Essa documentação completa aborda todos os tópicos solicitados com exemplos práticos de código, explicações detalhadas, e implementações no estilo Docusaurus. Você pode adaptar este conteúdo para sua própria documentação, modificando conforme necessário para seu caso de uso específico. 