"""
Remove chat de IA duplicado do BrainGraphView:
1. Remove import AgentView
2. Muda tipo de activeTab (remove "ask" | "agents")
3. Remove estado/ref de chat (chatMessages, chatInput, chatLoading, chatContainerRef, ChatMessage type)
4. Remove função sendChatMessage
5. Remove useEffect de auto-scroll do chat
6. Remove tabs "Perguntar à IA" e "Agentes" da navegação
7. Remove bloco de conteúdo da tab "ask"
8. Remove bloco de conteúdo da tab "agents"
"""
filepath = r'c:\Users\Testing Company\painel-qa\app\admin\brain\BrainGraphView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

original = content

# 1. Remove AgentView import
content = content.replace('import AgentView from "./AgentView";\n', '', 1)

# 2. Change activeTab type - remove "ask" and "agents"
content = content.replace(
    'const [activeTab, setActiveTab] = useState<"info" | "ask" | "create" | "timeline" | "agents">("info");',
    'const [activeTab, setActiveTab] = useState<"info" | "create" | "timeline">("info");',
    1
)

# 3. Remove chatContainerRef
content = content.replace(
    '  const chatContainerRef = useRef<HTMLDivElement>(null);\n\n',
    '',
    1
)

# 4. Remove ChatMessage type + chatMessages/chatInput/chatLoading state declarations
OLD_CHAT_STATE = (
    '  // Custom streaming chat state\n'
    '  type ChatMessage = { id: string; role: "user" | "assistant"; content: string };\n'
    '  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);\n'
    '  const [chatInput, setChatInput] = useState("");\n'
    '  const [chatLoading, setChatLoading] = useState(false);\n'
    '\n'
)
content = content.replace(OLD_CHAT_STATE, '', 1)

# 5. Remove the chat auto-scroll useEffect
OLD_SCROLL_EFFECT = (
    '  // Auto-scroll chat to bottom on new messages\n'
    '  useEffect(() => {\n'
    '    if (chatContainerRef.current && chatMessages.length > 0) {\n'
    '      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;\n'
    '    }\n'
    '  }, [chatMessages]);\n'
    '\n'
)
content = content.replace(OLD_SCROLL_EFFECT, '', 1)

print(f'1-5 applied. Changes so far: {content != original}')

# 6. Remove "Perguntar à IA" tab button
OLD_ASK_TAB_BTN = (
    '            <button\n'
    '              type="button"\n'
    '              className={activeTab === "ask" ? styles.panelTabActive : styles.panelTab}\n'
    '              onClick={() => setActiveTab("ask")}\n'
    '            >\n'
    '              {locale === "pt" ? "Perguntar \u00e0 IA" : "Ask AI"}\n'
    '            </button>\n'
)
content = content.replace(OLD_ASK_TAB_BTN, '', 1)

# 7. Remove "Agentes" tab button
OLD_AGENTS_TAB_BTN = (
    '            <button\n'
    '              type="button"\n'
    '              data-testid="brain-agents-tab"\n'
    '              className={activeTab === "agents" ? styles.panelTabActive : styles.panelTab}\n'
    '              onClick={() => setActiveTab("agents")}\n'
    '            >\n'
    '              {locale === "pt" ? "Agentes" : "Agents"}\n'
    '            </button>\n'
)
content = content.replace(OLD_AGENTS_TAB_BTN, '', 1)

print(f'6-7 applied.')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print(f'Written. Total changed: {content != original}')
