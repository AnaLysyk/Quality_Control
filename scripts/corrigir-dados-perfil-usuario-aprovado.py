from pathlib import Path

path = Path("app/api/admin/access-requests/[id]/accept/route.ts")
content = path.read_text(encoding="utf-8")

old = '''async function ensureLocalUser(message: string, fallbackEmail: string) {
  const resolved = await resolveRequestedUser(message, fallbackEmail);
  const created = await createLocalUser({
    full_name: resolved.fullName,
    name: resolved.displayName,
    email: resolved.email,
    user: resolved.login,
    password_hash: resolved.passwordHash,
    role: resolved.role,
    globalRole: resolved.globalRole,
    is_global_admin: resolved.isGlobalAdmin,
    ...resolveEditableProfileUserState(resolved.profileRole, resolved.linkCompanyId),
    active: true,
  });'''

new = '''async function ensureLocalUser(message: string, fallbackEmail: string) {
  const resolved = await resolveRequestedUser(message, fallbackEmail);
  const parsed = parseAccessRequestMessage(message, fallbackEmail);

  const created = await createLocalUser({
    full_name: resolved.fullName,
    name: resolved.displayName,
    email: resolved.email,
    user: resolved.login,
    password_hash: resolved.passwordHash,
    role: resolved.role,
    globalRole: resolved.globalRole,
    is_global_admin: resolved.isGlobalAdmin,
    phone: parsed.phone || null,
    job_title: parsed.jobRole || null,
    ...resolveEditableProfileUserState(resolved.profileRole, resolved.linkCompanyId),
    active: true,
  });'''

if old not in content:
    raise SystemExit("Não achei ensureLocalUser para substituir.")

content = content.replace(old, new, 1)
path.write_text(content, encoding="utf-8")
