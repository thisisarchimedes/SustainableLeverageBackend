import { type Context } from 'aws-lambda/handler';
import { Client, type ClientConfig } from 'pg';
import liquidator from './liquidator';

// RDS database configuration
let client: Client;
const dbConfig: ClientConfig = {
	user: process.env.DB_USER!,
	host: process.env.DB_HOST!,
	database: process.env.DB_NAME!,
	password: process.env.DB_PASSWORD!,
	port: Number(process.env.DB_PORT!),
	ssl: {
		rejectUnauthorized: false,
	},
};

// If 'client' variable doesn't exist
// @ts-expect-error cold start
if (typeof client === 'undefined') {
	// Connect to the database
	client = new Client(dbConfig);

	client.connect().catch(console.error);

	console.log('Connected to the database');
} else {
	console.log('Reusing database connection');
}

export async function handler(
	event: unknown,
	context: Context,
) {
	context.callbackWaitsForEmptyEventLoop = false;

	try {
		await liquidator(client);
	} catch (error) {
		console.error(error);
	}
}
