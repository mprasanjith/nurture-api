const PLANTNET_API_URL = "https://my-api.plantnet.org";

if (!process.env.PLANTNET_API_KEY) {
	throw new Error("PLANTNET_API_KEY environment variable is not set");
}
const PLANTNET_API_KEY = process.env.PLANTNET_API_KEY;

export interface PlantResult {
	id: string;
	commonNames: string[];
	scientificNameWithoutAuthor: string;
	scientificNameAuthorship: string;
	gbifId: string;
	powoId: string;
	iucnCategory: string | null;
}

export async function searchPlants(query: string) {
	const response = await fetch(
		`${PLANTNET_API_URL}/v2/species?lang=en&type=kt&prefix=${encodeURIComponent(query)}&api-key=${PLANTNET_API_KEY}`,
	);

	if (!response.ok) {
		throw new Error(`Plantnet API responded with status: ${response.status}`);
	}

	const data: PlantResult[] = await response.json();

	return data;
}
