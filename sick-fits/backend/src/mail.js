const nodemailer = require('nodemailer');

const transport = nodemailer.createTransport({
	host: '',
	port: process.env.MAIL_PORT,
	service: process.env.MAIL_SERVICE,
	auth: {
		user: process.env.MAIL_USER,
		pass: process.env.MAIL_PASS
	}
});

const makeANiceEmail = text => `
  <div className="email" style="
    border: 1px solid black;
    padding: 20px;
    font-family: sans-serif;
    line-height: 2;
    font-size: 20px;
  ">
    <h2>Hello There!</h2>
    <p>${text}</p>

    <p>😘, Trevor Johnson</p>
  </div>
`;

exports.transport = transport;
exports.makeANiceEmail = makeANiceEmail;
