import { Query } from 'react-apollo';
import gql from 'graphql-tag';
import PropTypes from 'prop-types';

const CURRENT_USER_QUERY = gql`
	query {
		me {
			id
			email
			name
			permissions
		}
	}
`;

const User = props => (
	<Query query={CURRENT_USER_QUERY}>{payload => props.children(payload)}</Query>
);

User.propTypes = { children: PropTypes.func.isRequired };

export { CURRENT_USER_QUERY };
export default User;
