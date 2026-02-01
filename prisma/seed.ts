
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL não definida');

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
	const user = await prisma.user.create({
		data: {
			email: 'admin@teste.com',
			password_hash: 'senha_hash',
			name: 'Admin',
			active: true,
		},
	});

	const company = await prisma.company.create({
		data: {
			name: 'Empresa Teste',
			slug: 'empresa-teste',
		},
	});

	await prisma.userCompany.create({
		data: {
			user_id: user.id,
			company_id: company.id,
			role: 'admin',
		},
	});

	console.log('Seed inserido com sucesso!');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
		await pool.end();
	});



