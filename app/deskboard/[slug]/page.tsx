import { redirect } from "next/navigation";

type DeskboardSlugPageProps = {
	params: {
		slug: string;
	};
};

export default function DeskboardSlugRedirect({ params }: DeskboardSlugPageProps) {
	void params;
	redirect("/empresas");
}
