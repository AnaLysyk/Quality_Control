"use client";

type Member = {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
};

type Props = {
  members: Member[];
};

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold overflow-hidden shrink-0">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials || "?"
      )}
    </div>
  );
}

export function TeamList({ members }: Props) {
  if (!members.length) {
    return <p className="text-sm text-gray-600">Nenhum usuário vinculado.</p>;
  }

  return (
    <div className="space-y-3">
      {members.map((member) => (
        <div key={member.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <Avatar name={member.name} avatarUrl={member.avatarUrl} />
          <div>
            <p className="text-sm font-semibold text-gray-900">{member.name}</p>
            <p className="text-xs text-gray-600">{member.role}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
