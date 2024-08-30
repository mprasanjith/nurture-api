export interface SearchResult {
	id: number;
	commonName: string;
	scientificNames: string[];
	otherNames: string[];
	thumbnail: string;
}

export interface PlantInfo {
	id: number;
	commonName: string;
	scientificNames: string[];
	otherNames: string[];
	type: string;
	cycle: string;
	watering: {
		frequency: string;
		benchmark: string | null;
	};
	sunlight: string[];
	care: {
		level: string;
		maintenance: string;
	};
	dimensions: {
		minHeight: number;
		maxHeight: number;
		unit: string;
	};
	indoor: boolean;
	flowering: {
		hasFlowers: boolean;
		season: string | null;
	};
	hardiness: {
		min: string;
		max: string;
	};
	propagation: string[];
	description: string;
	thumbnail: string;
	image: string;
}

export interface PlantPhotoMatch {
	results: {
		score: number;
		species: {
			scientificNameWithoutAuthor: string;
			scientificNameAuthorship: string;
			genus: {
				scientificNameWithoutAuthor: string;
				scientificNameAuthorship: string;
				scientificName: string;
			};
			family: {
				scientificNameWithoutAuthor: string;
				scientificNameAuthorship: string;
				scientificName: string;
			};
			commonNames: string[];
			scientificName: string;
		};
		gbif: {
			id: string;
		};
		powo: {
			id: string;
		};
	}[];
}
