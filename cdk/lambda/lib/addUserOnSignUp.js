const { initializeConnection } = require("./lib.js");
const { CognitoIdentityProviderClient, AdminGetUserCommand, AdminAddUserToGroupCommand } = require("@aws-sdk/client-cognito-identity-provider");

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
    // Get user attributes from Cognito to retrieve the email
    const getUserCommand = new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: userName,
    });
    const userAttributesResponse = await client.send(getUserCommand);

    const emailAttr = userAttributesResponse.UserAttributes.find(
      (attr) => attr.Name === "email"
    );
    const email = emailAttr ? emailAttr.Value : null;

    // Retrieve roles from the database
    const dbUser = await sqlConnection`
      SELECT roles FROM "Users" WHERE user_email = ${email};
    `;

    const dbRoles = dbUser[0]?.roles || [];

    // Determine the new Cognito group based on the roles
    const newGroupName = dbRoles.length > 0 ? dbRoles[0] : "user";

    // Add the user to the new group without removing existing groups
    const addUserToGroupCommand = new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: userName,
      GroupName: newGroupName,
    });
    await client.send(addUserToGroupCommand);

    return event;
  } catch (err) {
    console.error("Error assigning user to group:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
      }),
    };
  }
};
