const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { promisify } = require('util');

const jwtHelper = userId => jwt.sign({ userId }, process.env.APP_SECRET);

const expireTime = {
	httpOnly: true,
	maxAge: 1000 * 60 * 60 * 24 * 365 // 1 year cookie
};

const Mutations = {
	async createItem(parent, args, ctx, info) {
		// TODO: Check if they are logged in

		const item = await ctx.db.mutation.createItem(
			{
				data: {
					...args
				}
			},
			info
		);

		console.log(item);

		return item;
	},
	updateItem(parent, args, ctx, info) {
		// first take a copy of the updates
		const updates = { ...args };
		// remove the ID from the updates
		delete updates.id;
		// run the update method
		return ctx.db.mutation.updateItem(
			{
				data: updates,
				where: {
					id: args.id
				}
			},
			info
		);
	},
	async deleteItem(parent, args, ctx, info) {
		const where = { id: args.id };
		// 1. find the item
		const item = await ctx.db.query.item({ where }, `{ id title}`);
		// 2. Check if they own that item, or have the permissions
		return ctx.db.mutation.deleteItem({ where }, info);
	},
	async signup(parent, args, ctx, info) {
		try {
			args.email = args.email.toLowerCase();
			const password = await bcrypt.hash(args.password, 10);
			// create the user in the database
			const user = await ctx.db.mutation.createUser(
				{
					data: {
						...args,
						password,
						permissions: { set: ['USER'] }
					}
				},
				info
			);
			const token = jwtHelper(user.id);
			ctx.response.cookie('token', token, expireTime);
			return user;
		} catch (e) {
			return e;
		}
	},

	async signin(parent, { email, password }, ctx, info) {
		const user = await ctx.db.query.user({ where: { email } });
		if (!user) {
			throw new Error(`No such user found for email ${email}`);
		}
		const valid = await bcrypt.compare(password, user.password);

		if (!valid) throw new Error('Invalid Password!');

		const token = jwtHelper(user.id);

		ctx.response.cookie('token', token, expireTime);

		return user;
	},

	signout(parent, args, ctx, info) {
		ctx.response.clearCookie('token');
		return { message: 'Goodbye!' };
	},

	async requestReset(parent, { email }, ctx, info) {
		const user = await ctx.db.query.user({ where: { email } });
		if (!user) {
			throw new Error(`No user with email ${email}`);
		}
		const promiseRandomBytes = await promisify(randomBytes);
		const resetToken = (await promiseRandomBytes(20)).toString('hex');
		const resetTokenExpiry = Date.now() + 3600000;
		await ctx.db.mutation.updateUser({
			where: { email },
			data: { resetToken, resetTokenExpiry }
		});
		return { message: 'Thanks' };
	},

	async resetPassword(parent, { password, confirmPassword, resetToken }, ctx, info) {
		if (password !== confirmPassword) {
			throw new Error('Your passwords do not match');
		}
		const [user] = await ctx.db.query.users({
			where: {
				resetToken,
				resetTokenExpiry_gte: Date.now() - 3600000
			}
		});

		if (!user) throw new Error('Invalid Token');

		const hashed = await bcrypt.hash(password, 10);
		const updatedUser = await ctx.db.mutation.updateUser({
			where: { email: user.email },
			data: {
				password: hashed,
				resetToken: null,
				resetTokenExpiry: null
			}
		});

		const token = jwtHelper(updatedUser.id);
		ctx.response.cookie('token', token, expireTime);

		return updatedUser;
	}
};

module.exports = Mutations;
