import TicketDetailsModal from './TicketDetailsModal';

// Wrapper para aceitar prop 'suporte' e repassar como 'ticket'
export default function SuporteDetailsModal(props: any) {
	const { suporte, onSuporteUpdated, ...rest } = props;
	return (
		<TicketDetailsModal
			{...rest}
			ticket={suporte}
			onTicketUpdated={onSuporteUpdated}
		/>
	);
}
