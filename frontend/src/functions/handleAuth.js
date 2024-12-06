import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";
import AWS from "aws-sdk";

AWS.config.update({ logger: console });

// Gets current authorized user
export async function retrieveUser(setUser) {
  try {
    const returnedUser = await getCurrentUser();
    setUser(returnedUser);
    
  } catch (e) {
    console.error(e);
  }
}

// Gets jwtToken for current session
export async function retrieveJwtToken(setJwtToken) {
  try {
    var session = await fetchAuthSession();
    var idToken = await session.tokens.idToken
    
    var token = await session.tokens.accessToken.toString();
    setJwtToken(idToken);

    // Check if the token is close to expiration
    const expirationTime = session.credentials.expiration * 1000; // Milliseconds
    const currentTime = new Date().getTime();

    if (expirationTime - currentTime < 2700000) {
      // 45 minutes
      await fetchAuthSession();
      idToken = await session.tokens.idToken
      token = await session.tokens.accessToken.toString();
      setJwtToken(token);
    }
  } catch (e) {
    console.error(e);
  }
}

// get temp AWS credentials
export function getIdentityCredentials(jwtToken, setCredentials) {
  const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const IDENTITY_POOL_ID = import.meta.env.VITE_IDENTITY_POOL_ID;
  const REGION = import.meta.env.VITE_AWS_REGION;

  const creds = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: IDENTITY_POOL_ID,
    Logins: {
      [`cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`]: jwtToken,
    },
  });

  AWS.config.update({
    region: REGION,
    credentials: creds,
  });

  AWS.config.credentials.get(function () {
    setCredentials(creds);
  });
}
