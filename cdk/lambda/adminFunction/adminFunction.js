const { initializeConnection } = require("./libadmin.js");

let { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT } = process.env;

// SQL conneciton from global variable at libadmin.js
let sqlConnectionTableCreator = global.sqlConnectionTableCreator;

exports.handler = async (event) => {
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
  if (!sqlConnectionTableCreator) {
    await initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT);
    sqlConnectionTableCreator = global.sqlConnectionTableCreator;
  }

  // // Function to format student full names (lowercase and spaces replaced with "_")
  // const formatNames = (name) => {
  //   return name.toLowerCase().replace(/\s+/g, "_");
  // };

  let data;
  try {
    const pathData = event.httpMethod + " " + event.resource;
    switch (pathData) {
      case "PUT /admin/update_metadata":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.topic_id &&
          event.queryStringParameters.filename &&
          event.queryStringParameters.filetype
        ) {
          const topicId = event.queryStringParameters.topic_id;
          const filename = event.queryStringParameters.filename;
          const filetype = event.queryStringParameters.filetype;
          const { metadata } = JSON.parse(event.body);

          try {
            // Query to find the file with the given module_id and filename
            const existingFile = await sqlConnection`
                      SELECT * FROM "Documents"
                      WHERE topic_id = ${topicId}
                      AND filename = ${filename}
                      AND filetype = ${filetype};
                  `;

            if (existingFile.length === 0) {
              const result = await sqlConnection`
                INSERT INTO "Documents" (topic_id, filename, filetype, metadata)
                VALUES (${topicId}, ${filename}, ${filetype}, ${metadata})
                RETURNING *;
              `;
              response.body = JSON.stringify({
                message: "File metadata added successfully",
              });
            }

            // Update the metadata field
            const result = await sqlConnection`
                      UPDATE "Documents"
                      SET metadata = ${metadata}
                      WHERE topic_id = ${topicId}
                      AND filename = ${filename}
                      AND filetype = ${filetype}
                      RETURNING *;
                  `;

            if (result.length > 0) {
              response.statusCode = 200;
              response.body = JSON.stringify(result[0]);
            } else {
              response.statusCode = 500;
              response.body = JSON.stringify({
                error: "Failed to update metadata.",
              });
            }
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "topic_id and filename are required",
          });
        }
        break;
        case "POST /admin/create_topic":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.topic_name &&
          event.body
        ) {
          try {
            console.log("topic creation start");
            const {
              topic_name,
            } = event.queryStringParameters;

            const { system_prompt } = JSON.parse(event.body);

            // Insert new topic
            const newTopic = await sqlConnectionTableCreator`         
                  INSERT INTO "Topics" (
                      topic_id,
                      topic_name,
                      system_prompt
                  )
                  VALUES (
                      uuid_generate_v4(),
                      ${topic_name},
                      ${system_prompt}
                  )
                  RETURNING *;
              `;

            console.log(newTopic);
            response.body = JSON.stringify(newCourse[0]);
          } catch (err) {
            response.statusCode = 500;
            console.log(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = "Missing required parameters";
        }
        break;
        case "PUT /admin/edit_topic":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.topic_id &&
          event.queryStringParameters.topic_name
        ) {
          const topicId = event.queryStringParameters.topic_id;
          const topicName = event.queryStringParameters.topic_name;
          const { system_prompt } = JSON.parse(event.body);

          try {
            // Update the topic's name and system prompt in the Topics table
            const result = await sqlConnection`
                UPDATE "Topics"
                SET
                  topic_name = ${topicName},
                  system_prompt = ${system_prompt}
                WHERE
                  topic_id = ${topicId}
                RETURNING *;
              `;

            if (result.length > 0) {
              response.statusCode = 200;
              response.body = JSON.stringify(result[0]);
            } else {
              response.statusCode = 404;
              response.body = JSON.stringify({ error: "Concept not found" });
            }
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "topic_id and topic name are required",
          });
        }
        break;
        case "DELETE /admin/delete_topic":
          if (
            event.queryStringParameters != null &&
            event.queryStringParameters.topic_id
          ) {
            const topicId = event.queryStringParameters.module_id;
  
            try {
              // Delete the topic from the Topics table
              await sqlConnection`
                  DELETE FROM "Topics"
                  WHERE topic_id = ${topicId};
                `;
  
              response.statusCode = 200;
              response.body = JSON.stringify({
                message: "Topic deleted successfully",
              });
            } catch (err) {
              response.statusCode = 500;
              console.error(err);
              response.body = JSON.stringify({ error: "Internal server error" });
            }
          } else {
            response.statusCode = 400;
            response.body = JSON.stringify({ error: "topic_id is required" });
          }
          break;
          case "GET /admin/analytics":
            if (
              event.queryStringParameters != null &&
              event.queryStringParameters.topic_id
            ) {
              const topicId = event.queryStringParameters.topic_id;
    
              try {
                // Query to get all topics related to the given topic_id and their message counts, filtering by user role
                const messageCreations = await sqlConnection`
                    SELECT t.topic_id, t.topic_name, COUNT(m.message_id) AS message_count
                    FROM "Topics" t
                    LEFT JOIN "Sessions" s ON t.topic_id = s.topic_id
                    LEFT JOIN "Messages" m ON s.session_id = m.session_id
                    LEFT JOIN "User_Engagement_Log" uel ON t.topic_id = uel.topic_id
                    LEFT JOIN "Users" u ON uel.user_id = u.user_id
                    WHERE t.topic_id = ${topicId}
                    AND 'user' = ANY(u.roles)
                    GROUP BY t.topic_id, t.topic_name
                    ORDER BY t.topic_name ASC;
                `;
    
                // Query to get the number of topic accesses using User_Engagement_Log, filtering by user role
                const moduleAccesses = await sqlConnection`
                    SELECT uel.topic_id, COUNT(uel.log_id) AS access_count
                    FROM "User_Engagement_Log" uel
                    LEFT JOIN "Users" u ON uel.user_id = u.user_id
                    WHERE uel.topic_id = ${topicId}
                    AND uel.engagement_type = 'topic access'
                    AND 'user' = ANY(u.roles)
                    GROUP BY uel.topic_id;
                `;
    
                // Combine all data into a single response, ensuring all topics are included
                const analyticsData = messageCreations.map((topic) => {
                    const accesses =
                        moduleAccesses.find((ma) => ma.topic_id === topic.topic_id) || {};
    
                    return {
                        topic_id: topic.topic_id,
                        topic_name: topic.topic_name,
                        message_count: topic.message_count || 0,
                        access_count: accesses.access_count || 0,
                    };
                });
    
                response.statusCode = 200;
                response.body = JSON.stringify(analyticsData);
              } catch (err) {
                response.statusCode = 500;
                console.error(err);
                response.body = JSON.stringify({ error: "Internal server error" });
              }
            } else {
              response.statusCode = 400;
              response.body = JSON.stringify({ error: "course_id is required" });
            }
            break;
      default:
        throw new Error(`Unsupported route: "${pathData}"`);
    }
  } catch (error) {
    response.statusCode = 400;
    console.log(error);
    response.body = JSON.stringify(error.message);
  }
  console.log(response);
  return response;
};
