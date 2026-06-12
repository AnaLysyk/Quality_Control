filepath = r'c:\Users\Testing Company\painel-qa\app\admin\brain\BrainGraphView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line indices (0-based): buttons are at lines 2712-2723 and 2730-2741
# Patch line 2718 (0-based: 2717): message -> initialMessage with source/agentMode lines
# We'll rebuild the two blocks

# Block 1 lines 2712-2722 (0-based 2711-2721):
#   2712: onClick={() => {
#   2713:   window.dispatchEvent(new CustomEvent("assistant:open", {
#   2714:     detail: {
#   2715:       nodeId
#   2716:       nodeLabel
#   2717:       nodeType
#   2718:       message:   <-- need to add source/agentMode above, rename to initialMessage
#   2719:       ...
#   2720:       ...
#   2721:     }
#   2722:   }))

# Find the exact lines by searching content
content = ''.join(lines)

# Search for the markers
import re

# Replacement 1: first assistant:open block that doesn't have source yet
# Pattern: detail block without source: "brain"
OLD1 = (
    '                          window.dispatchEvent(new CustomEvent("assistant:open", {\n'
    '                            detail: {\n'
    '                              nodeId: selectedNode.id,\n'
    '                              nodeLabel: selectedNode.label,\n'
    '                              nodeType: selectedNode.type,\n'
    '                              message: locale === "pt"\n'
    '                                ? `Analise o n'
    + chr(92) + 'u00f3'
    + ' "${selectedNode.label}" (${selectedNode.type}) e me d'
    + chr(92) + 'u00ea'
    + ' um resumo dos riscos e contexto.`\n'
    '                                : `Analyze the node "${selectedNode.label}" (${selectedNode.type}) and give me a risk summary.`,\n'
    '                            },\n'
    '                          }));\n'
)
NEW1 = (
    '                          window.dispatchEvent(new CustomEvent("assistant:open", {\n'
    '                            detail: {\n'
    '                              source: "brain",\n'
    '                              agentMode: "qa",\n'
    '                              nodeId: selectedNode.id,\n'
    '                              nodeLabel: selectedNode.label,\n'
    '                              nodeType: selectedNode.type,\n'
    '                              initialMessage: locale === "pt"\n'
    '                                ? `Analise o n'
    + chr(92) + 'u00f3'
    + ' "${selectedNode.label}" (${selectedNode.type}) e me d'
    + chr(92) + 'u00ea'
    + ' um resumo dos riscos e contexto.`\n'
    '                                : `Analyze the node "${selectedNode.label}" (${selectedNode.type}) and give me a risk summary.`,\n'
    '                            },\n'
    '                          }));\n'
)

OLD2 = (
    '                          window.dispatchEvent(new CustomEvent("assistant:open", {\n'
    '                            detail: {\n'
    '                              nodeId: selectedNode.id,\n'
    '                              nodeLabel: selectedNode.label,\n'
    '                              nodeType: selectedNode.type,\n'
    '                              message: locale === "pt"\n'
    '                                ? `Busque mem'
    + chr(92) + 'u00f3'
    + 'rias e decis'
    + chr(92) + 'u00f5'
    + 'es registradas sobre "${selectedNode.label}".`\n'
    '                                : `Find memories and decisions about "${selectedNode.label}".`,\n'
    '                            },\n'
    '                          }));\n'
)
NEW2 = (
    '                          window.dispatchEvent(new CustomEvent("assistant:open", {\n'
    '                            detail: {\n'
    '                              source: "brain",\n'
    '                              agentMode: "memory",\n'
    '                              nodeId: selectedNode.id,\n'
    '                              nodeLabel: selectedNode.label,\n'
    '                              nodeType: selectedNode.type,\n'
    '                              initialMessage: locale === "pt"\n'
    '                                ? `Busque mem'
    + chr(92) + 'u00f3'
    + 'rias e decis'
    + chr(92) + 'u00f5'
    + 'es registradas sobre "${selectedNode.label}".`\n'
    '                                : `Find memories and decisions about "${selectedNode.label}".`,\n'
    '                            },\n'
    '                          }));\n'
)

found1 = OLD1 in content
found2 = OLD2 in content
print(f'OLD1 found: {found1}')
print(f'OLD2 found: {found2}')
content = content.replace(OLD1, NEW1, 1)
content = content.replace(OLD2, NEW2, 1)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
