import { redirect } from "next/navigation";

type DaskboardSlugPageProps = {
	params: {
		slug: string;
	};
};

export default function DaskboardSlugRedirect({ params }: DaskboardSlugPageProps) {
	const target = `/dashboard/${encodeURIComponent(params.slug)}`;
	redirect(target);
}
