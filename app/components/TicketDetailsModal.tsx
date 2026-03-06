import React, { useEffect, useState } from "react";

type TicketStatusOption = { value: string; label: string };
type TicketDetailsModalProps = {
	open: boolean;
	ticket: any;
	onClose: () => void;
	canEditStatus?: boolean;
	statusOptions?: TicketStatusOption[];
	onTicketUpdated?: (updated: any) => void;
};

const TicketDetailsModal: React.FC<TicketDetailsModalProps> = ({ open, ticket, onClose, onTicketUpdated }) => {
	const [devs, setDevs] = useState<Array<{ id: string; name: string }>>([]);
	const [assignedTo, setAssignedTo] = useState<string | null>(ticket?.assignedToUserId ?? null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;
		async function loadDevs() {
			if (!open || !ticket) return;
			try {
				const companyId = ticket.companyId ?? ticket.company?.id ?? null;
				if (!companyId) return;
				const res = await fetch(`/api/users?companyId=${encodeURIComponent(companyId)}`, { cache: "no-store", credentials: "include" });
				if (!res.ok) return;
				const users = await res.json().catch(() => []);
				if (!mounted) return;
				const devs = Array.isArray(users)
					? users
							.filter((u: any) => {
								const role = (u.role ?? "").toString().toLowerCase();
								return role === "dev" || role === "it_dev" || role === "itdev" || role === "developer";
							})
							.map((u: any) => ({ id: u.id, name: u.name || u.email || u.id }))
					: [];
				setDevs(devs);
			} catch {
				// ignore
			}
		}
		loadDevs();
		return () => {
			mounted = false;
		};
	}, [open, ticket]);

	useEffect(() => {
		setAssignedTo(ticket?.assignedToUserId ?? null);
	}, [ticket]);

	if (!open) return null;

	async function handleSave() {
		if (!ticket) return;
		setSaving(true);
		setError(null);
		try {
			const res = await fetch(`/api/suportes/${encodeURIComponent(ticket.id)}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ assignedToUserId: assignedTo }),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(json?.error || `Erro ${res.status}`);
			const updated = Array.isArray(json?.items) ? json.items[0] : json?.item ?? json;
			if (onTicketUpdated) onTicketUpdated(updated ?? null);
			setSaving(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setSaving(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6" role="dialog" aria-modal="true">
			<div className="w-full max-w-2xl rounded-2xl border border-(--tc-border)/30 bg-white p-6">
				<h2 className="text-lg font-bold mb-4">Detalhes do Chamado</h2>
				<div className="grid grid-cols-1 gap-4">
					<div>
						<label className="text-sm font-semibold text-(--tc-text-muted)">Título</label>
						<div className="mt-1 text-sm">{ticket?.title ?? ticket?.subject ?? `#${ticket?.code ?? ticket?.id}`}</div>
					</div>
					<div>
						<label className="text-sm font-semibold text-(--tc-text-muted)">Descrição</label>
						<div className="mt-1 text-sm whitespace-pre-wrap">{ticket?.description ?? ticket?.body ?? "-"}</div>
					</div>
					<div>
						<label className="text-sm font-semibold text-(--tc-text-muted)">Responsável (dev)</label>
						<select
							id={`suporte-assign-${ticket?.id ?? "current"}`}
							aria-label="Atribuir chamado a"
							className="w-full rounded-xl border border-(--tc-border) px-3 py-2 text-sm"
							value={assignedTo ?? ""}
							onChange={(e) => setAssignedTo(e.target.value || null)}
						>
							<option value="">-- nenhum --</option>
							{devs.map((d) => (
								<option key={d.id} value={d.id}>{d.name}</option>
							))}
						</select>
					</div>
					{error && <div className="text-sm text-rose-600">{error}</div>}
					<div className="flex justify-end gap-3">
						<button className="rounded-xl border px-4 py-2" onClick={onClose}>Fechar</button>
						<button className="rounded-xl bg-(--tc-accent) px-4 py-2 text-white" onClick={handleSave} disabled={saving}>
							{saving ? "Salvando..." : "Salvar responsavel"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default TicketDetailsModal;
