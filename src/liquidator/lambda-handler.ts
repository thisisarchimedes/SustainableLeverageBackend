import { type Context } from 'aws-lambda/handler';
import liquidator from './liquidator';
import { loadConfig } from '../lib/ConfigService';
import { Logger } from '@thisisarchimedes/backend-sdk';
import DataSource from '../lib/DataSource';


let dataSource: DataSource;

// Logger
let logger: Logger;

// Cold Start
// If 'dataSource' variable doesn't exist
// @ts-expect-error cold start
if (dataSource === undefined) {
	// Connect to the database
	dataSource = new DataSource();

	console.log('Creating new DataSource');
} else {
	console.log('Using existing DataSource');
}

// @ts-expect-error cold start
if (logger === undefined) {
	logger = Logger.getInstance();
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
		await liquidator(config, dataSource, logger);
	} catch (error) {
		console.error(error);
	}
}
