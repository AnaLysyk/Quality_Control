# testes/bd/brain

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/bd/brain
```

## Arquivos e casos de teste

### `brain.test.ts` (unit/integracao (jest))

**Describe:** Brain - Cérebro do Quality Control, Node Operations, Edge Operations, Memory Operations, Context Queries, Validation, Audit Logging, Complex Scenarios

- should create a Company node
- should create an Application node
- should create a Module node
- should update existing node by refType and refId
- should search nodes by type
- should search nodes by label
- should create an edge between two nodes
- should create edge with metadata
- should not create duplicate edges
- should fail if source node does not exist
- should fail if target node does not exist
- should add a memory
- should retrieve memories for a node
- should add memory with multiple related nodes
- should retrieve node with context
- should trace impact from a node
- should retrieve subgraph
- should validate brain integrity
- should report correct statistics
- should log node creation
- should log edge creation
- should log memory addition
- should build a company → app → module hierarchy
- should handle queries on complex subgraphs

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/bd/brain/brain.test.ts
```
