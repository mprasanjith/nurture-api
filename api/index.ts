import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { ObjectId } from "mongodb";
import { db } from "../lib/db";
import { getPlant, searchPlants } from "../lib/perenual";
import { Plant, type SearchResult } from "../types";
import { identifyPlant } from "../lib/plantnet";

const app = new Hono().basePath("/api");

// Middleware
app.use("*", cors());
app.use("*", clerkMiddleware());

app.use("*", async (c, next) => {
	const auth = getAuth(c);
	if (!auth?.userId) {
		return c.json(
			{
				message: "You are not logged in.",
			},
			401,
		);
	}
	await next();
});

// Helper function to get user ID
const getUserId = (c: Context) => getAuth(c)?.userId;

app.get("/plants", async (c) => {
	const userId = getUserId(c);
	const plants = await db.collection("plants").find({ userId }).toArray();
	return c.json({ data: plants });
});

app.post("/plants", async (c) => {
	const userId = getUserId(c);
	if (!userId) {
		return c.json({ message: "You are not logged in." }, 401);
	}

	const body: { id: number } = await c.req.json();
	if (!body.id) {
		return c.json({ message: "Plant ID is required" }, 400);
	}

	const plantInfo = await getPlant(body.id);

	const newPlant = {
		_id: new ObjectId(),
		info: plantInfo,
		userId,
		addedAt: new Date().toISOString(),
		reminders: [],
		name: plantInfo.commonName,
	};
	await db.collection("plants").insertOne(newPlant);

	return c.json({ data: newPlant }, 201);
});

app.get("/plants/:id", async (c) => {
	const userId = getUserId(c);
	const plantId = c.req.param("id");

	const plant = await db
		.collection("plants")
		.findOne({ _id: new ObjectId(plantId), userId });

	if (!plant) {
		return c.json({ message: "Plant not found" }, 404);
	}

	return c.json({ data: plant });
});

app.delete("/plants/:id", async (c) => {
	const userId = getUserId(c);
	const plantId = c.req.param("id");
	const result = await db
		.collection("plants")
		.deleteOne({ _id: new ObjectId(plantId), userId });
	if (result.deletedCount === 0) {
		return c.json({ message: "Plant not found" }, 404);
	}
	return c.json({ message: "Plant deleted successfully" });
});

app.post("/plants/:id/reminders", async (c) => {
	const userId = getUserId(c);
	const plantId = c.req.param("id");
	const reminderData = await c.req.json();

	const newReminder = {
		id: new ObjectId().toString(),
		...reminderData,
		lastCompleted: null,
		nextDue: new Date(
			Date.now() + reminderData.frequency * 24 * 60 * 60 * 1000,
		).toISOString(),
		history: [],
	};

	try {
		const result = await db
			.collection("plants")
			.updateOne(
				{ _id: new ObjectId(plantId), userId },
				{ $push: { reminders: newReminder } },
			);

		if (result.matchedCount === 0) {
			return c.json({ message: "Plant not found" }, 404);
		}

		return c.json({ data: newReminder });
	} catch (error) {
		console.error("Error adding reminder:", error);
		return c.json({ message: "Error adding reminder" }, 500);
	}
});

// Update a specific reminder
app.put("/plants/:id/reminders/:reminderId", async (c) => {
	const userId = getUserId(c);
	const plantId = c.req.param("id");
	const reminderId = c.req.param("reminderId");
	const updateData = await c.req.json();

	try {
		const result = await db.collection("plants").updateOne(
			{ _id: new ObjectId(plantId), userId, "reminders.id": reminderId },
			{
				$set: {
					"reminders.$.type": updateData.type,
					"reminders.$.frequency": updateData.frequency,
					"reminders.$.nextDue": new Date(
						Date.now() + updateData.frequency * 24 * 60 * 60 * 1000,
					).toISOString(),
				},
			},
		);

		if (result.matchedCount === 0) {
			return c.json({ message: "Plant or reminder not found" }, 404);
		}

		const updatedPlant = await db
			.collection("plants")
			.findOne(
				{ _id: new ObjectId(plantId), userId },
				{ projection: { reminders: { $elemMatch: { id: reminderId } } } },
			);

		return c.json({ data: updatedPlant?.reminders[0] });
	} catch (error) {
		console.error("Error updating reminder:", error);
		return c.json({ message: "Error updating reminder" }, 500);
	}
});

app.delete("/plants/:id/reminders/:reminderId", async (c) => {
	const userId = getUserId(c);
	const plantId = c.req.param("id");
	const reminderId = c.req.param("reminderId");

	try {
		const result = await db
			.collection("plants")
			.updateOne(
				{ _id: new ObjectId(plantId), userId },
				{ $pull: { reminders: { id: reminderId } } },
			);

		if (result.matchedCount === 0) {
			return c.json({ message: "Plant not found" }, 404);
		}

		if (result.modifiedCount === 0) {
			return c.json({ message: "Reminder not found" }, 404);
		}

		return c.json({ message: "Reminder deleted successfully" });
	} catch (error) {
		console.error("Error deleting reminder:", error);
		return c.json({ message: "Error deleting reminder" }, 500);
	}
});

app.post("/plants/:id/reminders/:reminderId/complete", async (c) => {
	const userId = getUserId(c);
	const plantId = c.req.param("id");
	const reminderId = c.req.param("reminderId");

	if (!userId) {
		return c.json({ message: "You are not logged in." }, 401);
	}

	const plant = await db
		.collection<Plant>("plants")
		.findOne({ _id: new ObjectId(plantId), userId });
	if (!plant) {
		return c.json({ message: "Plant not found" }, 404);
	}

	try {
		const now = new Date().toISOString();
		const result = await db.collection("plants").updateOne(
			{ _id: new ObjectId(plantId), userId, "reminders.id": reminderId },
			{
				$set: {
					"reminders.$.lastCompleted": now,
					"reminders.$.nextDue": new Date(
						Date.now() +
							// @ts-ignore: Assuming frequency is in days
							(plant.reminders.find((r) => r.id === reminderId)?.frequency ||
								0) *
								24 *
								60 *
								60 *
								1000,
					).toISOString(),
				},
				$push: {
					"reminders.$.history": now,
				},
			},
		);

		console.log({ result });

		if (result.matchedCount === 0) {
			return c.json({ message: "Plant or reminder not found" }, 404);
		}

		const updatedPlant = await db
			.collection("plants")
			.findOne(
				{ _id: new ObjectId(plantId), userId },
				{ projection: { reminders: { $elemMatch: { id: reminderId } } } },
			);

		return c.json({ data: updatedPlant?.reminders[0] });
	} catch (error) {
		console.error("Error completing reminder:", error);
		return c.json({ message: "Error completing reminder" }, 500);
	}
});

app.get("/search", async (c) => {
	const query = c.req.query("q");
	if (!query) {
		return c.json({ message: "Search query is required" }, 400);
	}

	try {
		const plantResults = await searchPlants(query);
		return c.json({ data: plantResults });
	} catch (error) {
		console.error("Error fetching data from Plantnet API:", error);
		return c.json({ message: "Error fetching plant data" }, 500);
	}
});

app.get("/info/:id", async (c) => {
	const id = c.req.param("id");

	const plantId = Number.parseInt(id);

	try {
		const plant = await getPlant(plantId);
		return c.json({ data: plant });
	} catch (error) {
		console.error("Error fetching data from Perenual API:", error);
		return c.json({ message: "Error fetching plant data" }, 500);
	}
});

app.post("/identify", async (c) => {
	const body = await c.req.parseBody();
	const file = body.file;

	if (!file) {
		return c.json({ message: "File is required" }, 400);
	}

	try {
		const results = await identifyPlant(file);
		if (!results) {
			return c.json({ message: "No plant found" }, 404);
		}

		let plant: SearchResult[] = [];
		plant = await searchPlants(results.species.scientificNameWithoutAuthor);

		if (plant.length === 0) {
			// Try searching by the first common name if no exact match was found
			plant = await searchPlants(results.species.commonNames[0]);
		}

		if (plant.length === 0) {
			return c.json({ message: "No plant found" }, 404);
		}

		return c.json({ data: plant[0] });
	} catch (error) {
		console.error("Error fetching data from Plantnet API:", error);
		return c.json({ message: "Error fetching plant data" }, 500);
	}
});

export default app;
