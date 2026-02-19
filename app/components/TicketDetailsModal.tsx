import React from "react";

type TicketStatusOption = { value: string; label: string };
type TicketDetailsModalProps = {
	open: boolean;
	ticket: any;
	onClose: () => void;
	canEditStatus?: boolean;
	statusOptions?: TicketStatusOption[];
	onTicketUpdated?: (updated: any) => void;
};

const TicketDetailsModal: React.FC<TicketDetailsModalProps> = ({ open, ticket, onClose }) => {
	if (!open) return null;
	return (
		<div>
			<h2>Detalhes do Chamado</h2>
			<pre>{JSON.stringify(ticket, null, 2)}</pre>
			<button onClick={onClose}>Fechar</button>
		</div>
	);
};

export default TicketDetailsModal;
