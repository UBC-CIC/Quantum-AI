const { initializeConnection } = require("./lib.js");
const { CognitoIdentityProviderClient, AdminListGroupsForUserCommand, AdminGetUserCommand, AdminAddUserToGroupCommand, AdminRemoveUserFromGroupCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT } = process.env;
let sqlConnection = global.sqlConnection;

exports.handler = async (event) => {
  if (!sqlConnection) {
    await initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT);
    sqlConnection = global.sqlConnection;
  }

  const { userName, userPoolId } = event;
  const client = new CognitoIdentityProviderClient();

  try {
    // Get user groups from Cognito
    const userGroupsCommand = new AdminListGroupsForUserCommand({
      UserPoolId: userPoolId,
      Username: userName,
    });
    const userGroupsResponse = await client.send(userGroupsCommand);
    const cognitoRoles = userGroupsResponse.Groups.map(group => group.GroupName);

    // Get user attributes
    const userAttributesCommand = new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: userName,
    });
    const userAttributesResponse = await client.send(userAttributesCommand);

    const emailAttr = userAttributesResponse.UserAttributes.find(attr => attr.Name === 'email');
    const email = emailAttr ? emailAttr.Value : null;

    // Retrieve roles from the database
    const dbUser = await sqlConnection`
      SELECT roles FROM "Users"
      WHERE user_email = ${email};
    `;
    
    const dbRoles = dbUser[0]?.roles || [];

    // Handle role synchronization between Cognito and DB
    if (cognitoRoles.includes('admin')) {
      // If Cognito has admin, make sure DB is also admin
      if (!dbRoles.includes('admin')) {
        await sqlConnection`
          UPDATE "Users"
          SET roles = array_append(roles, 'admin')
          WHERE user_email = ${email};
        `;
        
      }
    } else if (cognitoRoles.some(role => ['user'].includes(role))) {
      const cognitoNonAdminRole = cognitoRoles.find(role => ['user'].includes(role));
      
      if (dbRoles.includes('admin')) {
        // If DB has admin but Cognito is not admin, update DB role to match Cognito
        await sqlConnection`
          UPDATE "Users"
          SET roles = ${[cognitoNonAdminRole]}
          WHERE user_email = ${email};
        `;
        
      } else if (dbRoles.length && dbRoles[0] !== cognitoNonAdminRole) {
        // If DB role doesn't match Cognito and isn't admin, update Cognito to match DB
        const removeFromGroupCommand = new AdminRemoveUserFromGroupCommand({
          UserPoolId: userPoolId,
          Username: userName,
          GroupName: cognitoNonAdminRole,
        });
        const addToGroupCommand = new AdminAddUserToGroupCommand({
          UserPoolId: userPoolId,
          Username: userName,
          GroupName: dbRoles[0],
        });

        await client.send(removeFromGroupCommand);
        await client.send(addToGroupCommand);

        
      }
    }

    return event;
  } catch (err) {
    console.error(err);
    return event;
  }
};
