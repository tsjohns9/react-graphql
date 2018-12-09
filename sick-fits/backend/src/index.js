require('dotenv').config();
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const createServer = require('./createServer');
const db = require('./db');

const server = createServer();

server.express.use(cookieParser());

// decode jwt to get user id on each request
server.express.use((req, res, next) => {
	const { token } = req.cookies;
	if (token) {
		const { userId } = jwt.verify(token, process.env.APP_SECRET);
		// put the userId onto the request for future requeststo access
		req.userId = userId;
	}
	next();
});

server.express.use(async (req, res, next) => {
	// if they aren't logged in, skip this
	if (!req.userId) return next();
	const user = await db.query.user(
		{ where: { id: req.userId } },
		'{ id, permissions, email, name }'
	);
	req.user = user;
	next();
});

server.start(
	{
		cors: {
			credentials: true,
			origin: process.env.FRONTEND_URL
		}
	},
	server => {
		console.log(`Server is now running on port http://localhost:${server.port}`);
	}
);
