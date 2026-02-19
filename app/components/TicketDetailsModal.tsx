import React from "react";

type TicketDetailsModalProps = {
	open: boolean;
	ticket: any;
	onClose: () => void;
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
