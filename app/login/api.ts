export async function login({ login, password }: { login: string; password: string }) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ login, password }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data?.error ||
      data?.message ||
      "Não foi possível entrar. Verifique usuário e senha.";
    throw new Error(message);
  }

  return data;
}
