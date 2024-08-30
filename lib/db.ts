import { MongoClient } from "mongodb";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is not set");
}
const uri = process.env.DATABASE_URL;

const client = new MongoClient(uri);
export const db = client.db("nurture");
