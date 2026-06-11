from pathlib import Path

path = Path("app/api/admin/access-requests/[id]/route.ts")
content = path.read_text(encoding="utf-8")

content = content.replace(
'''import {
  composeAccessRequestMessage,
  normalizeAccessType,
  parseAccessRequestMessage,
} from "@/lib/accessRequestMessage";''',
'''import {
  composeAccessRequestMessage,
  normalizeAccessType,
  parseAccessRequestMessage,
} from "@/lib/accessRequestMessage";
import { hashPasswordSha256 } from "@/lib/passwordHash";'''
)

content = content.replace(
'''  admin_notes?: string | null;
};''',
'''  admin_notes?: string | null;
  password?: string | null;
};'''
)

content = content.replace(
'''  const adminNotes = typeof body.admin_notes === "string" ? body.admin_notes.trim() : null;''',
'''  const adminNotes = typeof body.admin_notes === "string" ? body.admin_notes.trim() : null;
  const password = typeof body.password === "string" ? body.password.trim() : "";
  const passwordHash = password ? hashPasswordSha256(password) : null;'''
)

content = content.replace(
'''      passwordHash: parsed.passwordHash,''',
'''      passwordHash: passwordHash ?? parsed.passwordHash,''',
1
)

content = content.replace(
'''      passwordHash: parsed.passwordHash,''',
'''      passwordHash: passwordHash ?? parsed.passwordHash,''',
1
)

content = content.replace(
'''      passwordHash: parsed.passwordHash,''',
'''      passwordHash: passwordHash ?? parsed.passwordHash,''',
1
)

path.write_text(content, encoding="utf-8")
