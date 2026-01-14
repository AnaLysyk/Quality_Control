import { redirect } from "next/navigation";

type DeskboardSlugPageProps = {
	params: {
		slug: string;
	};
};

export default function DeskboardSlugRedirect({ params }: DeskboardSlugPageProps) {
	const target = `/dashboard/${encodeURIComponent(params.slug)}`;
	redirect(target);
}
