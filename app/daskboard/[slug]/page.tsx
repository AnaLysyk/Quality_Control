import { redirect } from "next/navigation";

type DaskboardSlugPageProps = {
	params: {
		slug: string;
	};
};

export default function DaskboardSlugRedirect({ params }: DaskboardSlugPageProps) {
	void params;
	redirect("/empresas");
}
