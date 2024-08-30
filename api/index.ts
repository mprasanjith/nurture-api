import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { Hono } from "hono";
import { handle } from "hono/vercel";

export const config = {
	runtime: "edge",
};

const app = new Hono().basePath("/api");

app.use("*", clerkMiddleware());
app.get("/", (c) => {
	const auth = getAuth(c);

	if (!auth?.userId) {
		return c.json({
			message: "You are not logged in.",
		});
	}

	return c.json({
		message: "You are logged in!",
		userId: auth.userId,
	});
});

export default handle(app);
