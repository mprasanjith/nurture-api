import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { type Document, ObjectId } from "mongodb";
import { db } from "../lib/db";
import { getPlant, searchPlants } from "../lib/perenual";
import { Plant, type PlantUpdateInput } from "../types";

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

app.put("/plants/:id", async (c) => {
	const userId = getUserId(c);
	const plantId = c.req.param("id");
	const updateData: PlantUpdateInput = await c.req.json();

	const updateOperations: Document = {};

	// Update plant name if provided
	if (updateData.name) {
		updateOperations.$set = { name: updateData.name };
	}

	// Handle reminder operations
	if (updateData.reminders) {
		// Add new reminders
		if (updateData.reminders.add && updateData.reminders.add.length > 0) {
			const newReminders = updateData.reminders.add.map((reminder) => ({
				id: new ObjectId().toString(),
				...reminder,
				lastCompleted: new Date().toISOString(),
				nextDue: new Date(
					Date.now() + reminder.frequency * 24 * 60 * 60 * 1000,
				).toISOString(),
				history: [],
			}));
			updateOperations.$push = { reminders: { $each: newReminders } };
		}

		// Remove reminders
		if (updateData.reminders.remove && updateData.reminders.remove.length > 0) {
			updateOperations.$pull = {
				reminders: { id: { $in: updateData.reminders.remove } },
			};
		}

		// Update existing reminders
		if (updateData.reminders.update && updateData.reminders.update.length > 0) {
			const bulkWriteOperations = updateData.reminders.update.map(
				(reminder) => ({
					updateOne: {
						filter: { _id: new ObjectId(plantId), "reminders.id": reminder.id },
						update: {
							$set: {
								"reminders.$.type": reminder.type,
								"reminders.$.frequency": reminder.frequency,
								"reminders.$.nextDue": new Date(
									Date.now() + reminder.frequency * 24 * 60 * 60 * 1000,
								).toISOString(),
							},
						},
					},
				}),
			);

			try {
				await db.collection("plants").bulkWrite(bulkWriteOperations);
			} catch (error) {
				console.error("Error updating reminders:", error);
				return c.json({ message: "Error updating reminders" }, 500);
			}
		}
	}

	try {
		const result = await db
			.collection("plants")
			.updateOne({ _id: new ObjectId(plantId), userId }, updateOperations);

		if (result.matchedCount === 0) {
			return c.json({ message: "Plant not found" }, 404);
		}

		const updatedPlant = await db
			.collection("plants")
			.findOne({ _id: new ObjectId(plantId), userId });
		return c.json({ data: updatedPlant });
	} catch (error) {
		console.error("Error updating plant:", error);
		return c.json({ message: "Error updating plant" }, 500);
	}
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

app.get("/search", async (c) => {
	const query = c.req.query("q");
	if (!query) {
		return c.json({ message: "Search query is required" }, 400);
	}

	console.log("Searching for plants:", query);

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

export default app;
