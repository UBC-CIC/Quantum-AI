const { initializeConnection } = require("./lib.js");
let { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT, USER_POOL } = process.env;
const {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

// SQL conneciton from global variable at lib.js
let sqlConnection = global.sqlConnection;

exports.handler = async (event) => {
  const cognito_id = event.requestContext.authorizer.userId;
  const client = new CognitoIdentityProviderClient();
  const userAttributesCommand = new AdminGetUserCommand({
    UserPoolId: USER_POOL,
    Username: cognito_id,
  });
  const userAttributesResponse = await client.send(userAttributesCommand);

  const emailAttr = userAttributesResponse.UserAttributes.find(
    (attr) => attr.Name === "email"
  );
  const userEmailAttribute = emailAttr ? emailAttr.Value : null;
  
  // Check for query string parameters

  const queryStringParams = event.queryStringParameters || {};
  const queryEmail = queryStringParams.email;
  const userEmail = queryStringParams.user_email;

  const isUnauthorized =
    (queryEmail && queryEmail !== userEmailAttribute) ||
    (userEmail && userEmail !== userEmailAttribute);

  if (isUnauthorized) {
    return {
      statusCode: 401,
      headers: {
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
      },
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
    },
    body: "",
  };

  // Initialize the database connection if not already initialized
  if (!sqlConnection) {
    await initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT);
    sqlConnection = global.sqlConnection;
  }

  let data;
  try {
    const pathData = event.httpMethod + " " + event.resource;
    switch (pathData) {
      case "POST /user/create_user":
        if (event.queryStringParameters) {
          const {
            user_email,
            username,
            first_name,
            last_name,
            preferred_name,
          } = event.queryStringParameters;

          try {
            // Check if the user already exists
            const existingUser = await sqlConnection`
                SELECT * FROM "Users"
                WHERE user_email = ${user_email};
            `;

            if (existingUser.length > 0) {
              // Update the existing user's information
              const updatedUser = await sqlConnection`
                    UPDATE "Users"
                    SET
                        username = ${username},
                        first_name = ${first_name},
                        last_name = ${last_name},
                        preferred_name = ${preferred_name},
                        last_sign_in = CURRENT_TIMESTAMP,
                        time_account_created = CURRENT_TIMESTAMP
                    WHERE user_email = ${user_email}
                    RETURNING *;
                `;
              response.body = JSON.stringify(updatedUser[0]);
            } else {
              // Insert a new user with 'user' role
              const newUser = await sqlConnection`
                    INSERT INTO "Users" (user_email, username, first_name, last_name, preferred_name, time_account_created, roles, last_sign_in)
                    VALUES (${user_email}, ${username}, ${first_name}, ${last_name}, ${preferred_name}, CURRENT_TIMESTAMP, ARRAY['user'], CURRENT_TIMESTAMP)
                    RETURNING *;
                `;
              response.body = JSON.stringify(newUser[0]);
            }
          } catch (err) {
            response.statusCode = 500;
            
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "User data is required" });
        }
        break;
      case "GET /user/get_user_roles":
        if (
          event.queryStringParameters &&
          event.queryStringParameters.user_email
        ) {
          const user_email = event.queryStringParameters.user_email;
          try {
            // Retrieve roles for the user with the provided email
            const userData = await sqlConnection`
                SELECT roles
                FROM "Users"
                WHERE user_email = ${user_email};
              `;
            if (userData.length > 0) {
              response.body = JSON.stringify({ roles: userData[0].roles });
            } else {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "User not found" });
            }
          } catch (err) {
            response.statusCode = 500;
            
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "User email is required" });
        }
        break;
      case "GET /user/get_name":
        if (
          event.queryStringParameters &&
          event.queryStringParameters.user_email
        ) {
          const user_email = event.queryStringParameters.user_email;
          try {
            // Retrieve roles for the user with the provided email
            const userData = await sqlConnection`
                  SELECT first_name
                  FROM "Users"
                  WHERE user_email = ${user_email};
                `;
            if (userData.length > 0) {
              response.body = JSON.stringify({ name: userData[0].first_name });
            } else {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "User not found" });
            }
          } catch (err) {
            response.statusCode = 500;
            
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "User email is required" });
        }
        break;
    case "GET /user/topics":
      try {
          // Query to get all topics ordered by topic_name
          const topicsData = await sqlConnection`
              SELECT "Topics".*
              FROM "Topics"
              ORDER BY "Topics".topic_name;
          `;
          response.body = JSON.stringify(topicsData);
      } catch (err) {
          response.statusCode = 500;
          console.error(err);
          response.body = JSON.stringify({ error: "Internal server error" });
      }
      break;
      case "GET /user/sessions":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.email
        ) {
          const userEmail = event.queryStringParameters.email;

          try {
            // Step 1: Get the user ID using the user_email
            const userResult = await sqlConnection`
                  SELECT user_id
                  FROM "Users"
                  WHERE user_email = ${userEmail}
                  LIMIT 1;
              `;

            if (userResult.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "User not found.",
              });
              break;
            }

            const userId = userResult[0].user_id;

            // Step 4: Retrieve session data for the user
            const data = await sqlConnection`
                  SELECT "Sessions".*
                  FROM "Sessions"
                  WHERE user_id = ${userId}
                  ORDER BY "Sessions".last_accessed, "Sessions".session_id;
              `;

            response.body = JSON.stringify(data);
          } catch (err) {
            console.error(err);
            response.statusCode = 500;
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Invalid value" });
        }
        break;
      case "POST /user/create_session":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.topic_id &&
          event.queryStringParameters.email &&
          event.queryStringParameters.session_name
        ) {
          const topicId = event.queryStringParameters.topic_id;
          const userEmail = event.queryStringParameters.email;
          const sessionName = event.queryStringParameters.session_name;

          try {
            // Step 1: Get the user ID using the user_email
            const userResult = await sqlConnection`
                  SELECT user_id
                  FROM "Users"
                  WHERE user_email = ${userEmail}
                  LIMIT 1;
              `;

            if (userResult.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "User not found.",
              });
              break;
            }

            const userId = userResult[0].user_id;

            // Step 2: Insert a new session with the session_name
            const sessionData = await sqlConnection`
                  INSERT INTO "Sessions" (session_id, user_id, topic_id, session_name, last_accessed)
                  VALUES (
                    uuid_generate_v4(),
                    ${userId},
                    ${topicId},
                    ${sessionName},
                    CURRENT_TIMESTAMP
                  )
                  RETURNING *;
              `;

            // Step 3: Insert an entry into the User_Engagement_Log
            await sqlConnection`
                  INSERT INTO "User_Engagement_Log" (log_id, user_id, topic_id, timestamp, engagement_type)
                  VALUES (
                    uuid_generate_v4(),
                    ${userId},
                    ${topicId},
                    CURRENT_TIMESTAMP,
                    'session creation'
                  )
                `;

            response.body = JSON.stringify(sessionData);
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "Invalid value",
          });
        }
        break;
        case "PUT /user/update_session_name":
          if (
            event.queryStringParameters != null &&
            event.queryStringParameters.session_id &&
            event.body
          ) {
            try {
              const { session_id } = event.queryStringParameters;
              const { session_name } = JSON.parse(event.body);
  
              // Update the session name
              const updateResult = await sqlConnection`
                  UPDATE "Sessions"
                  SET session_name = ${session_name}
                  WHERE session_id = ${session_id}
                  RETURNING *;
                `;
  
              if (updateResult.length === 0) {
                response.statusCode = 404;
                response.body = JSON.stringify({ error: "Session not found" });
                break;
              }
  
              response.statusCode = 200;
              response.body = JSON.stringify(updateResult[0]);
            } catch (err) {
              console.error(err);
              response.statusCode = 500;
              response.body = JSON.stringify({ error: "Internal server error" });
            }
          } else {
            response.statusCode = 400;
            response.body = JSON.stringify({ error: "Invalid value" });
          }
          break;
      case "DELETE /user/delete_session":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.session_id &&
          event.queryStringParameters.email &&
          event.queryStringParameters.topic_id
        ) {
          const sessionId = event.queryStringParameters.session_id;
          const userEmail = event.queryStringParameters.email;
          const topicId = event.queryStringParameters.topic_id;

          try {
            // Step 1: Get the user ID using the user_email
            const userResult = await sqlConnection`
                  SELECT user_id
                  FROM "Users"
                  WHERE user_email = ${userEmail}
                  LIMIT 1;
              `;

            if (userResult.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "User not found." });
              break;
            }

            const userId = userResult[0].user_id;

            // Step 2: Delete the session and get the result
            const deleteResult = await sqlConnection`
                  DELETE FROM "Sessions"
                  WHERE session_id = ${sessionId}
                  RETURNING *;
              `;

            // Step 3: Insert an entry into the User_Engagement_Log
            await sqlConnection`
                  INSERT INTO "User_Engagement_Log" (log_id, user_id, topic_id, timestamp, engagement_type)
                  VALUES (uuid_generate_v4(), ${userId}, ${topicId}, CURRENT_TIMESTAMP, 'session deletion');
              `;
            
            response.body = JSON.stringify({ success: "Session deleted" });
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "session_id, email and topic_id are required",
          });
        }
        break;
      case "POST /user/create_message":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.session_id &&
          event.queryStringParameters.email &&
          event.queryStringParameters.topic_id &&
          event.body
        ) {
          const sessionId = event.queryStringParameters.session_id;
          const { message_content } = JSON.parse(event.body);
          const userEmail = event.queryStringParameters.email;
          const topicId = event.queryStringParameters.topic_id;
          
          
          
          

          try {
            // Insert the new message into the Messages table with a generated UUID for message_id
            const messageData = await sqlConnection`
                INSERT INTO "Messages" (message_id, session_id, user_sent, message_content, time_sent)
                VALUES (uuid_generate_v4(), ${sessionId}, true, ${message_content}, CURRENT_TIMESTAMP)
                RETURNING *;
              `;

            // Update the last_accessed field in the Sessions table
            await sqlConnection`
                UPDATE "Sessions"
                SET last_accessed = CURRENT_TIMESTAMP
                WHERE session_id = ${sessionId};
              `;

            // Retrieve user_id based on userEmail
            const userData = await sqlConnection`
                SELECT user_id
                FROM "Users"
                WHERE user_email = ${userEmail};
              `;

            const userId = userData[0]?.user_id;
            
            await sqlConnection`
                INSERT INTO "User_Engagement_Log" (log_id, user_id, topic_id, timestamp, engagement_type)
                VALUES (uuid_generate_v4(), ${userId}, ${topicId}, CURRENT_TIMESTAMP, 'message creation');
              `;

            response.body = JSON.stringify(messageData);
          } catch (err) {
            response.statusCode = 500;
            
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "session_id and message_content are required",
          });
        }
        break;
      case "POST /user/create_ai_message":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.session_id &&
          event.queryStringParameters.email &&
          event.queryStringParameters.topic_id &&
          event.body
        ) {
          const sessionId = event.queryStringParameters.session_id;
          const { message_content } = JSON.parse(event.body);
          const userEmail = event.queryStringParameters.email;
          const topicId = event.queryStringParameters.topic_id;
          
          
          
          

          try {
            // Insert the new AI message into the Messages table with a generated UUID for message_id
            const messageData = await sqlConnection`
                INSERT INTO "Messages" (message_id, session_id, user_sent, message_content, time_sent)
                VALUES (uuid_generate_v4(), ${sessionId}, false, ${message_content}, CURRENT_TIMESTAMP)
                RETURNING *;
              `;

            // Update the last_accessed field in the Sessions table
            await sqlConnection`
                UPDATE "Sessions"
                SET last_accessed = CURRENT_TIMESTAMP
                WHERE session_id = ${sessionId};
              `;

            // Retrieve user_id based on userEmail
            const userData = await sqlConnection`
                SELECT user_id
                FROM "Users"
                WHERE user_email = ${userEmail};
              `;

            const userId = userData[0]?.user_id;

            await sqlConnection`
                INSERT INTO "User_Engagement_Log" (log_id, user_id, topic_id, timestamp, engagement_type)
                VALUES (uuid_generate_v4(), ${userId}, ${topicId}, CURRENT_TIMESTAMP, 'AI message creation');
              `;

            response.body = JSON.stringify(messageData);
          } catch (err) {
            response.statusCode = 500;
            
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "session_id and message_content are required",
          });
        }
        break;
        case "GET /user/get_messages":
          if (
            event.queryStringParameters != null &&
            event.queryStringParameters.session_id
          ) {
            try {
              const sessionId = event.queryStringParameters.session_id;
  
              // Query to get all messages in the given session, sorted by time_sent in ascending order (oldest to newest)
              const data = await sqlConnection`
                        SELECT *
                        FROM "Messages"
                        WHERE session_id = ${sessionId}
                        ORDER BY time_sent ASC;
                    `;
  
              if (data.length > 0) {
                response.body = JSON.stringify(data);
                response.statusCode = 200;
              } else {
                response.body = JSON.stringify({
                  message: "No messages found for this session.",
                });
                response.statusCode = 404;
              }
            } catch (err) {
              response.statusCode = 500;
              
              response.body = JSON.stringify({ error: "Internal server error" });
            }
          } else {
            response.statusCode = 400;
            response.body = JSON.stringify({ error: "session_id is required" });
          }
          break;
        case "POST /user/create_user_session_engagement_log":
          if (
            event.queryStringParameters != null &&
            event.queryStringParameters.session_id &&
            event.queryStringParameters.email &&
            event.queryStringParameters.engagement_type
          ) {
            const sessionId = event.queryStringParameters.session_id;
            const userEmail = event.queryStringParameters.email;
            const engagementType = event.queryStringParameters.engagement_type;
  
            try {
              // Step 1: Get the user ID using the user_email
              const userResult = await sqlConnection`
                    SELECT user_id
                    FROM "Users"
                    WHERE user_email = ${userEmail}
                    LIMIT 1;
                `;
  
              if (userResult.length === 0) {
                response.statusCode = 404;
                response.body = JSON.stringify({
                  error: "User not found.",
                });
                break;
              }
  
              const userId = userResult[0].user_id;
  
              // Step 2: Insert an entry into the User_Engagement_Log
              const result = await sqlConnection`
                    INSERT INTO "User_Session_Engagement_Log" (log_id, user_id, session_id, timestamp, engagement_type)
                    VALUES (
                      uuid_generate_v4(),
                      ${userId},
                      ${sessionId},
                      CURRENT_TIMESTAMP,
                      ${engagementType}
                    )
                  `;
  
              response.body = JSON.stringify(result);
            } catch (err) {
              response.statusCode = 500;
              console.error(err);
              response.body = JSON.stringify({ error: "Internal server error" });
            }
          } else {
            response.statusCode = 400;
            response.body = JSON.stringify({
              error: "Invalid value",
            });
          }
          break;
        case "POST /user/create_feedback":
          if (
            event.queryStringParameters.topic_id &&
            event.queryStringParameters.feedback_rating &&
            event.queryStringParameters.feedback_description &&
            event.body
          ) {
            const topicId = event.queryStringParameters.topic_id;
            const feedbackRating = event.queryStringParameters.feedback_rating;
            const feedbackDescription = event.queryStringParameters.feedback_description;
            const { user_message, ai_message } = JSON.parse(event.body);
            
            
            

            try {
              const feedbackData = await sqlConnection`
                      INSERT INTO "Feedback" (feedback_id, topic_id, feedback_rating, feedback_description, timestamp, user_message, ai_message)
                      VALUES (
                        uuid_generate_v4(),
                        ${topicId.trim()},
                        ${feedbackRating},
                        ${feedbackDescription},
                        CURRENT_TIMESTAMP,
                        ${user_message},
                        ${ai_message}
                      )
                      RETURNING *;
                  `;

              response.body = JSON.stringify(feedbackData);
            } catch (err) {
              response.statusCode = 500;
              console.error(err);
              response.body = JSON.stringify({ error: "Internal server error" });
            }
          } else {
            response.statusCode = 400;
            response.body = JSON.stringify({
              error: "Invalid value",
            });
          }
          break;
      default:
        throw new Error(`Unsupported route: "${pathData}"`);
    }
  } catch (error) {
    response.statusCode = 400;
    
    response.body = JSON.stringify(error.message);
  }
  

  return response;
};
