import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { ObjectId } from "mongodb";
import { db } from "../lib/db";
import { getPlant, searchPlants } from "../lib/perenual";
import type { SearchResult } from "../types";

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
	const plantData = await c.req.json();
	const newPlant = { ...plantData, userId };
	const result = await db.collection("plants").insertOne(newPlant);
	return c.json({ data: { ...newPlant, _id: result.insertedId } }, 201);
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
	const updateData = await c.req.json();
	const result = await db
		.collection("plants")
		.updateOne({ _id: new ObjectId(plantId), userId }, { $set: updateData });
	if (result.matchedCount === 0) {
		return c.json({ message: "Plant not found" }, 404);
	}
	const updatedPlant = await db
		.collection("plants")
		.findOne({ _id: new ObjectId(plantId), userId });
	return c.json({ data: updatedPlant });
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
