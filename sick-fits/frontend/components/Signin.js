import React, { Component } from 'react';
import { Mutation } from 'react-apollo';
import gql from 'graphql-tag';

import Form from './styles/Form';
import Error from './ErrorMessage';
import { CURRENT_USER_QUERY } from './User';

const SIGNIN_MUTATION = gql`
	mutation SIGNIN_MUTATION($email: String!, $password: String!) {
		signin(email: $email, password: $password) {
			id
			email
			name
		}
	}
`;

class Signin extends Component {
	state = {
		email: '',
		password: ''
	};

	saveToState = ({ target: { name, value } }) => {
		this.setState({
			[name]: value
		});
	};

	render() {
		return (
			<Mutation
				mutation={SIGNIN_MUTATION}
				variables={this.state}
				refetchQueries={[{ query: CURRENT_USER_QUERY }]}
			>
				{(signup, { error, loading }) => {
					return (
						<Form
							method="post"
							onSubmit={async e => {
								e.preventDefault();
								await signup();
								this.setState({ email: '', password: '' });
							}}
						>
							<fieldset disabled={loading} aria-busy={loading}>
								<h2>Sign into your account</h2>
								<Error error={error} />
								<label htmlFor="email">
									Email
									<input
										type="text"
										name="email"
										value={this.state.email}
										onChange={this.saveToState}
										placeholder="email"
									/>
								</label>
								<label htmlFor="password">
									Password
									<input
										type="password"
										name="password"
										value={this.state.password}
										onChange={this.saveToState}
										placeholder="password"
									/>
								</label>
								<button type="submit">Sign In</button>
							</fieldset>
						</Form>
					);
				}}
			</Mutation>
		);
	}
}

export default Signin;
