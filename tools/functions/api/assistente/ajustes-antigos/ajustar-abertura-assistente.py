import sys

filepath = r'c:\Users\Testing Company\painel-qa\app\admin\brain\BrainGraphView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Patch 1: Analisar riscos - add source/agentMode qa, rename message->initialMessage
old1 = (
    '                          window.dispatchEvent(new CustomEvent("assistant:open", {\n'
    '                            detail: {\n'
    '                              nodeId: selectedNode.id,\n'
    '                              nodeLabel: selectedNode.label,\n'
    '                              nodeType: selectedNode.type,\n'
    '                              message: locale === "pt"\n'
    '                                ? `Analise o n\u00f3 "${selectedNode.label}" (${selectedNode.type}) e me d\u00ea um resumo dos riscos e contexto.`\n'
    '                                : `Analyze the node "${selectedNode.label}" (${selectedNode.type}) and give me a risk summary.`,\n'
    '                            },\n'
    '                          }));'
)
new1 = (
    '                          window.dispatchEvent(new CustomEvent("assistant:open", {\n'
    '                            detail: {\n'
    '                              source: "brain",\n'
    '                              agentMode: "qa",\n'
    '                              nodeId: selectedNode.id,\n'
    '                              nodeLabel: selectedNode.label,\n'
    '                              nodeType: selectedNode.type,\n'
    '                              initialMessage: locale === "pt"\n'
    '                                ? `Analise o n\u00f3 "${selectedNode.label}" (${selectedNode.type}) e me d\u00ea um resumo dos riscos e contexto.`\n'
    '                                : `Analyze the node "${selectedNode.label}" (${selectedNode.type}) and give me a risk summary.`,\n'
    '                            },\n'
    '                          }));'
)

# Patch 2: Ver memorias - add source/agentMode memory, rename message->initialMessage
old2 = (
    '                          window.dispatchEvent(new CustomEvent("assistant:open", {\n'
    '                            detail: {\n'
    '                              nodeId: selectedNode.id,\n'
    '                              nodeLabel: selectedNode.label,\n'
    '                              nodeType: selectedNode.type,\n'
    '                              message: locale === "pt"\n'
    '                                ? `Busque mem\u00f3rias e decis\u00f5es registradas sobre "${selectedNode.label}".`\n'
    '                                : `Find memories and decisions about "${selectedNode.label}".`,\n'
    '                            },\n'
    '                          }));'
)
new2 = (
    '                          window.dispatchEvent(new CustomEvent("assistant:open", {\n'
    '                            detail: {\n'
    '                              source: "brain",\n'
    '                              agentMode: "memory",\n'
    '                              nodeId: selectedNode.id,\n'
    '                              nodeLabel: selectedNode.label,\n'
    '                              nodeType: selectedNode.type,\n'
    '                              initialMessage: locale === "pt"\n'
    '                                ? `Busque mem\u00f3rias e decis\u00f5es registradas sobre "${selectedNode.label}".`\n'
    '                                : `Find memories and decisions about "${selectedNode.label}".`,\n'
    '                            },\n'
    '                          }));'
)

c = content
found1 = old1 in c
found2 = old2 in c
c = c.replace(old1, new1, 1)
c = c.replace(old2, new2, 1)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(c)

print(f'Patch 1 found: {found1}')
print(f'Patch 2 found: {found2}')
print(f'File changed: {c != content}')
