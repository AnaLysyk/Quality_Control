"""
Remove blocos de ask tab e agents tab do BrainGraphView.tsx usando linha markers.
Também remove função sendChatMessage e tab button residual.
"""
filepath = r'c:\Users\Testing Company\painel-qa\app\admin\brain\BrainGraphView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Localiza blocos a remover buscando marcadores únicos
def find_line(marker, start=0):
    for i, l in enumerate(lines[start:], start=start):
        if marker in l:
            return i
    return -1

# ── 1. Remove tab button "ask" residual ──────────────────────────────────────
# Busca o botão com "ask" no className e "Ask AI" no conteúdo
ask_btn_start = None
for i, l in enumerate(lines):
    if 'activeTab === "ask"' in l and 'panelTab' in l:
        # Vai para o button que começa antes
        for j in range(i-2, i+10):
            if '<button' in lines[j] and 'type="button"' in lines[j]:
                ask_btn_start = j
                break
        break

if ask_btn_start is not None:
    # Encontra o fechamento </button>
    depth = 0
    ask_btn_end = None
    for i in range(ask_btn_start, ask_btn_start + 20):
        if '<button' in lines[i]:
            depth += 1
        if '</button>' in lines[i]:
            depth -= 1
            if depth == 0:
                ask_btn_end = i
                break
    if ask_btn_end:
        print(f'Tab ask button: lines {ask_btn_start+1}-{ask_btn_end+1}')
        del lines[ask_btn_start:ask_btn_end+1]
        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        print('Tab ask button removed.')
else:
    print('Tab ask button NOT found (already removed?)')

# ── 2. Remove bloco {activeTab === "ask" ? ( ... ) : activeTab === "timeline" ──
# Busca o início: {activeTab === "ask" ?
ask_content_start = find_line('{activeTab === "ask" ?')
if ask_content_start == -1:
    ask_content_start = find_line("activeTab === 'ask'")

print(f'ask content block starts at line {ask_content_start+1}')

# O bloco termina com ") : activeTab === \"timeline\" ?"
# Busca a linha que fecha o bloco e abre o timeline
ask_content_end = None
for i in range(ask_content_start, ask_content_start + 200):
    if 'activeTab === "timeline"' in lines[i] and ') :' in lines[i]:
        # Linha anterior é o fechamento do bloco ask
        ask_content_end = i - 1
        break

print(f'ask content block ends at line {ask_content_end+1 if ask_content_end else "NOT FOUND"}')

if ask_content_start != -1 and ask_content_end:
    del lines[ask_content_start:ask_content_end+1]
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    print('Ask content block removed.')

# ── 3. Remove bloco activeTab === "agents" ───────────────────────────────────
agents_start = find_line('activeTab === "agents"')
print(f'agents block starts at line {agents_start+1}')

if agents_start != -1:
    # O bloco termina com ") : (" que inicia o info tab
    agents_end = None
    for i in range(agents_start, agents_start + 20):
        if ') : (' in lines[i] or '/* Info tab' in lines[i]:
            agents_end = i - 1
            break
        # Alternativa: linha com '/* Info tab */' ou  '/* info' ou empty else clause
    # Simpler: find line that has AgentView closing and the next meaningful block
    for i in range(agents_start, agents_start + 20):
        if 'AgentView' in lines[i]:
            # Skip forward to find closing ) :
            for j in range(i, i + 15):
                if ') : (' in lines[j] or (') :' in lines[j] and 'null' not in lines[j]):
                    agents_end = j - 1
                    break
            break
    print(f'agents block ends at line {agents_end+1 if agents_end else "NOT FOUND"}')
    if agents_end:
        del lines[agents_start:agents_end+1]
        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        print('Agents content block removed.')

# ── 4. Remove função sendChatMessage ────────────────────────────────────────
sc_start = find_line('async function sendChatMessage(')
print(f'sendChatMessage starts at line {sc_start+1}')

if sc_start != -1:
    # Find end of function - next 'async function' or 'function' at same indent
    sc_end = None
    for i in range(sc_start + 1, sc_start + 80):
        stripped = lines[i].lstrip()
        if (stripped.startswith('async function ') or stripped.startswith('function ')) and not lines[i].startswith(' ' * 6):
            sc_end = i - 1
            break
    print(f'sendChatMessage ends at line {sc_end+1 if sc_end else "NOT FOUND"}')
    if sc_end:
        del lines[sc_start:sc_end+1]
        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        print('sendChatMessage removed.')

print('\nDone. Checking remaining issues:')
for keyword in ['AgentView', 'sendChatMessage', 'chatMessages', 'chatInput', 'chatLoading', 'chatContainerRef']:
    hits = [i+1 for i,l in enumerate(lines) if keyword in l]
    if hits:
        print(f'  {keyword}: lines {hits}')
    else:
        print(f'  {keyword}: CLEAN')
