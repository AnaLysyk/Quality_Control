import Link from "next/link";

const releases = [
  { id: "v1_6_2", name: "Release 1.6.2" },
  { id: "v1_7_0", name: "Release 1.7.0" },
  { id: "v1_8_0", name: "Release 1.8.0" },
];

export default function ReleasesPage() {
  return (
    <div className="text-white p-10">
      <h1 className="text-3xl font-bold mb-6">Releases Disponíveis</h1>

      <ul className="space-y-4">
        {releases.map((r) => (
          <li key={r.id}>
            <Link
              href={`/releases/${r.id}`}
              className="text-blue-400 underline hover:text-blue-200"
            >
              {r.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
