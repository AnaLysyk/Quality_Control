import RunDetailClient from "./RunDetailClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    id: string;
  };
};

export default function RunDetailPage({ params }: PageProps) {
  return <RunDetailClient runId={params.id} />;
}

