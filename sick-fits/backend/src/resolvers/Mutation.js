const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { promisify } = require('util');
const { transport, makeANiceEmail } = require('../mail');
const { hasPermission } = require('../utils');

const jwtHelper = userId => jwt.sign({ userId }, process.env.APP_SECRET);

const expireTime = {
	httpOnly: true,
	maxAge: 1000 * 60 * 60 * 24 * 365 // 1 year cookie
};

const Mutations = {
	async createItem(parent, args, ctx, info) {
		if (!ctx.request.userId) {
			throw new Error('You must be logged in to do that');
		}

		const item = await ctx.db.mutation.createItem(
			{
				data: {
					// creates a relationship between item and user
					user: {
						connect: {
							id: ctx.request.userId
						}
					},
					...args
				}
			},
			info
		);

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
    const item = await ctx.db.query.item({ where }, `{ id title user { id }}`);
    // 2. Check if they own that item, or have the permissions
    const ownsItem = item.user.id === ctx.request.userId;
    const hasPermissions = ctx.request.user.permissions.some(permission =>
      ['ADMIN', 'ITEMDELETE'].includes(permission)
    );

    if (!ownsItem && !hasPermissions) {
      throw new Error("You don't have permission to do that!");
    }

    // 3. Delete it!
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

		await transport.sendMail({
			from: 'wes@wesbos.com',
			to: user.email,
			subject: 'Your Password Reset Token',
			html: makeANiceEmail(`Your Password Reset Token is here!
      \n\n
      <a href="${process.env.FRONTEND_URL}/reset?resetToken=${resetToken}">Click Here to Reset</a>`)
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
	},

	async updatePermissions(parent, args, ctx, info) {
		// 1. Check if they are logged in
		if (!ctx.request.userId) {
			throw new Error('You must be logged in!');
		}
		// 2. Query the current user
		const currentUser = await ctx.db.query.user(
			{
				where: {
					id: ctx.request.userId
				}
			},
			info
		);
		// 3. Check if they have permissions to do this
		hasPermission(currentUser, ['ADMIN', 'PERMISSIONUPDATE']);
		// 4. Update the permissions
		return ctx.db.mutation.updateUser(
			{
				data: {
					permissions: {
						set: args.permissions
					}
				},
				where: {
					id: args.userId
				}
			},
			info
		);
	}
};

module.exports = Mutations;
