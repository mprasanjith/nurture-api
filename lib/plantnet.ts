import type { PlantPhotoMatch } from "../types";

const PLANTNET_API_URL = "https://my-api.plantnet.org";

if (!process.env.PLANTNET_API_KEY) {
	throw new Error("PLANTNET_API_KEY environment variable is not set");
}
const PLANTNET_API_KEY = process.env.PLANTNET_API_KEY;

export async function identifyPlant(image: string | File) {
	const formData = new FormData();
	formData.append("images", image);

	const response = await fetch(
		`${PLANTNET_API_URL}/v2/identify/all?nb-results=1&api-key=${PLANTNET_API_KEY}`,
		{
			method: "POST",
			headers: {
				accept: "application/json",
			},
			body: formData,
		},
	);

	if (!response.ok) {
		if (response.status === 404) {
			return null;
		}

		throw new Error(`Plantnet API responded with status: ${response.status}`);
	}

	const matches: { results: PlantPhotoMatch[] } = await response.json();

	return matches.results?.[0];
}
