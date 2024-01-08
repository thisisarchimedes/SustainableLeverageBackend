import { type Context } from 'aws-lambda/handler';
import { Client, type ClientConfig } from 'pg';
import liquidator from './liquidator';
import { loadConfig } from '../lib/config-service';
import { Logger } from '@thisisarchimedes/backend-sdk';

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

// Logger
let logger: Logger;

// If 'client' variable doesn't exist
// @ts-expect-error cold start
if (typeof client === 'undefined') {
	// Connect to the database
	client = new Client(dbConfig);

	client.connect().catch(console.error);

	console.log('Connecting to the database');
} else {
	console.log('Reusing database connection');
}

// @ts-expect-error cold start
if (typeof logger === 'undefined') {
	logger = new Logger(process.env.NEW_RELIC_LICENSE_KEY!, process.env.NEW_RELIC_API_URI!, process.env.ENVIRONMENT!);
}

export async function handler(
	event: unknown,
	context: Context,
) {
	context.callbackWaitsForEmptyEventLoop = false;

	// Load Config
	const config = await loadConfig();
	console.log(config);

	try {
		await liquidator(config, client, logger);
	} catch (error) {
		console.error(error);
	}
}
