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
            // Query to find the file with the given topic_id and filename
            const existingFile = await sqlConnectionTableCreator`
                      SELECT * FROM "Documents"
                      WHERE topic_id = ${topicId}
                      AND filename = ${filename}
                      AND filetype = ${filetype};
                  `;

            if (existingFile.length === 0) {
              const result = await sqlConnectionTableCreator`
                INSERT INTO "Documents" (topic_id, filename, filetype, metadata)
                VALUES (${topicId}, ${filename}, ${filetype}, ${metadata})
                RETURNING *;
              `;
              response.body = JSON.stringify({
                message: "File metadata added successfully",
              });
            }

            // Update the metadata field
            const result = await sqlConnectionTableCreator`
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

            if (topic_name.toLowerCase() === "general") {
              response.statusCode = 400;
              response.body = JSON.stringify({
                error: "Topic name cannot be 'General'",
              });
              break;
            }
            
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
            response.body = JSON.stringify(newTopic[0]);
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
            const result = await sqlConnectionTableCreator`
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
              response.body = JSON.stringify({ error: "Topic not found" });
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
            const topicId = event.queryStringParameters.topic_id;
  
            try {
              // Delete the topic from the Topics table
              await sqlConnectionTableCreator`
                  DELETE FROM "Topics"
                  WHERE topic_id = ${topicId};
                `;
              
               // Delete from the autogenerated langchain_pg_collection table
              await sqlConnectionTableCreator`
                  DELETE FROM "langchain_pg_collection"
                  WHERE name = ${topicId};
              `;

              // Delete from User_Session_Engagement_Log where session belongs to the topic
              await sqlConnectionTableCreator`
                  DELETE FROM "User_Session_Engagement_Log"
                  WHERE session_id IN (
                      SELECT session_id
                      FROM "Sessions"
                      WHERE topic_id = ${topicId}
                  );
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
            try {
              // Query to get all topics related to the given topic_id and their message counts, filtering by user role
              const messageCreations = await sqlConnectionTableCreator`
                  SELECT t.topic_id, t.topic_name, COUNT(DISTINCT CASE WHEN m.user_sent = true THEN m.message_id END) AS user_message_count, COUNT(DISTINCT CASE WHEN m.user_sent = false THEN m.message_id END) AS ai_message_count
                  FROM "Topics" t
                  LEFT JOIN "Sessions" s ON t.topic_id = s.topic_id
                  LEFT JOIN "Messages" m ON s.session_id = m.session_id
                  LEFT JOIN "User_Engagement_Log" uel ON t.topic_id = uel.topic_id
                  LEFT JOIN "Users" u ON uel.user_id = u.user_id
                  AND 'user' = ANY(u.roles)
                  GROUP BY t.topic_id, t.topic_name
                  ORDER BY t.topic_name ASC;
              `;

              // Query to get the number of topic accesses using User_Engagement_Log, filtering by user role
              const sessionCreations = await sqlConnectionTableCreator`
                  SELECT t.topic_id, COUNT(uel.log_id) AS session_creation_count
                  FROM "Topics" t
                  LEFT JOIN "User_Engagement_Log" uel ON t.topic_id = uel.topic_id
                  LEFT JOIN "Users" u ON uel.user_id = u.user_id
                  WHERE uel.engagement_type = 'session creation'
                  AND 'user' = ANY(u.roles)
                  GROUP BY t.topic_id
                  ORDER BY t.topic_id ASC;
              `;

              const sessionDeletions = await sqlConnectionTableCreator`
                SELECT t.topic_id, COUNT(uel.log_id) AS session_deletion_count
                FROM "Topics" t
                LEFT JOIN "User_Engagement_Log" uel ON t.topic_id = uel.topic_id
                LEFT JOIN "Users" u ON uel.user_id = u.user_id
                WHERE uel.engagement_type = 'session deletion'
                AND 'user' = ANY(u.roles)
                GROUP BY t.topic_id
                ORDER BY t.topic_id ASC;
              `;

              // Step 1: Fetch logs in descending order (newest logs first) and filter by user role
              const logs = await sqlConnectionTableCreator`
                  SELECT uel.*, u.user_id 
                  FROM "User_Session_Engagement_Log" uel
                  JOIN "Users" u ON uel.user_id = u.user_id
                  WHERE 'user' = ANY(u.roles)
                  ORDER BY uel."timestamp" ASC;
              `;

              // Initialize stack and a map to store session durations
              const stack = [];
              const sessionDurations = new Map(); // session_id => total duration

              // Step 2: Process logs with the stack to calculate session durations
              for (const log of logs) {
                const { session_id, timestamp, engagement_type } = log;

                if (engagement_type === "session start") {
                    // Push "session start" log onto the stack
                    stack.push(log);
                } else if (engagement_type === "session end") {
                    // Look for matching "session start" log on top of the stack
                    let matched = false;
                    for (let i = stack.length - 1; i >= 0; i--) {
                        const endLog = stack[i];
                        if (endLog.session_id === session_id) {
                            // Calculate session duration
                            const calculatedDuration = (new Date(timestamp) - new Date(endLog.timestamp)) / 1000; // in seconds
                            const duration = Math.min(calculatedDuration, 3600); // Cap at 3600 seconds (60 minutes)
                            if (sessionDurations.has(session_id)) {
                                sessionDurations.set(session_id, sessionDurations.get(session_id) + duration);
                            } else {
                                sessionDurations.set(session_id, duration);
                            }
                            // Remove the matched "session start" log from the stack
                            stack.splice(i, 1);
                            matched = true;
                            break;
                        }
                    }
                    // If no match is found, push "session end" log to stack for later deletion
                    if (!matched) {
                        console.log("No matching start log found, pushing to stack:", log);
                        stack.push(log);
                    }
                }
              }

              const unmatchedSessionStarts = stack.filter(log => log.engagement_type === "session start");
              
              // Add 20 minutes (1200 seconds) to the session map for unmatched "session start" logs
              for (const unmatchedStart of unmatchedSessionStarts) {
                const { session_id } = unmatchedStart;
                const defaultDuration = 1200; // 20 minutes in seconds
                if (sessionDurations.has(session_id)) {
                    sessionDurations.set(session_id, sessionDurations.get(session_id) + defaultDuration);
                } else {
                    sessionDurations.set(session_id, defaultDuration);
                }
              }

              // Step 3: Delete all unmatched logs (remaining items in the stack)
              const unmatchedLogs = stack.map(log => log.log_id); // Extract log_ids of all unmatched logs
              console.log("Unmatched logs:", unmatchedLogs);
              if (unmatchedLogs.length > 0) {
                  await sqlConnectionTableCreator`
                      DELETE FROM "User_Session_Engagement_Log"
                      WHERE "log_id" = ANY(${unmatchedLogs});
                  `;
              }

              console.log("Session durations:", sessionDurations);

              // Step 4: Calculate the average session time per topic
              const sessionDetails = await sqlConnectionTableCreator`
                  SELECT s.session_id, s.topic_id, u.user_id
                  FROM "Sessions" s
                  JOIN "User_Session_Engagement_Log" uel ON s.session_id = uel.session_id
                  JOIN "Users" u ON uel.user_id = u.user_id
                  WHERE 'user' = ANY(u.roles);
              `;

              const topicDurations = {}; // topic_id => { totalDuration: number, sessionCount: number, uniqueUsers: Set }

              console.log("Session details:", sessionDetails);

              sessionDetails.forEach(({ session_id, topic_id, user_id }) => {
                  if (!topicDurations[topic_id]) {
                      topicDurations[topic_id] = { totalDuration: 0, sessionCount: 0, uniqueUsers: new Set() };
                  }
                  if (sessionDurations.has(session_id)) {
                      topicDurations[topic_id].totalDuration += sessionDurations.get(session_id);
                      topicDurations[topic_id].sessionCount += 1; // Increment session count for each session added
                      topicDurations[topic_id].uniqueUsers.add(user_id);
                  }
              });

              console.log("Topic durations:", topicDurations);

              const totalSessionTimes = Object.entries(topicDurations).map(([topic_id, data]) => ({
                  topic_id,
                  average_session_time: data.sessionCount > 0 
                      ? (data.totalDuration / data.sessionCount)
                      : 0
              }));

              const averageSessionTimes = Object.entries(topicDurations).map(([topic_id, data]) => ({
                  topic_id,
                  average_session_time: data.sessionCount > 0 
                      ? ((data.totalDuration / data.sessionCount) / (data.sessionCount / 2)) / data.uniqueUsers.size  // Divide by session count and unique users for average session duration
                      : 0
              }));

              // Combine all data into a single response, ensuring all topics are included
              const analyticsData = messageCreations.map((topic) => {
                  const sessionsCreated = sessionCreations.find((ma) => ma.topic_id === topic.topic_id) || {};
                  const sessionsDeleted = sessionDeletions.find((sd) => sd.topic_id === topic.topic_id) || {};
                  const avgSessionData = averageSessionTimes.find(avg => avg.topic_id === topic.topic_id) || {};
                  const totalSessionData = totalSessionTimes.find(avg => avg.topic_id === topic.topic_id) || {};

                  return {
                      topic_id: topic.topic_id,
                      topic_name: topic.topic_name,
                      user_message_count: topic.user_message_count || 0,
                      ai_message_count: topic.ai_message_count || 0,
                      sessions_created: sessionsCreated.session_creation_count || 0,
                      sessions_deleted: sessionsDeleted.session_deletion_count || 0,
                      average_session_time: avgSessionData.average_session_time || 0,
                      total_session_time: totalSessionData.average_session_time || 0
                  };
              });

              response.statusCode = 200;
              response.body = JSON.stringify(analyticsData);
            } catch (err) {
              response.statusCode = 500;
              console.error(err);
              response.body = JSON.stringify({ error: "Internal server error" });
            }
            break;
          case "GET /admin/feedback":
            try {
              // Fetch feedback entries with average ratings per topic
              const feedbackEntries = await sqlConnectionTableCreator`
                SELECT 
                  t.topic_name,
                  f.feedback_id,
                  f.feedback_rating,
                  f.feedback_description,
                  f.timestamp,
                  f.user_message,
                  f.ai_message,
                  AVG(f.feedback_rating) OVER (PARTITION BY t.topic_name) AS average_rating
                FROM "Feedback" f
                JOIN "Topics" t ON f.topic_id = t.topic_id
                ORDER BY t.topic_name ASC, f.timestamp DESC;
              `;
          
              if (feedbackEntries.length === 0) {
                response.statusCode = 404;
                response.body = JSON.stringify({
                  error: "No feedback found",
                });
              } else {
                // Organize feedback by topic_name
                const groupedFeedback = feedbackEntries.reduce((acc, feedback) => {
                  const {
                    topic_name,
                    feedback_id,
                    feedback_rating,
                    feedback_description,
                    timestamp,
                    average_rating,
                    user_message,
                    ai_message,
                  } = feedback;
          
                  if (!acc[topic_name]) {
                    acc[topic_name] = {
                      topic_name,
                      average_rating: parseFloat(average_rating), // Ensure average rating is a number
                      feedback: [],
                    };
                  }
          
                  acc[topic_name].feedback.push({
                    feedback_id,
                    feedback_rating,
                    feedback_description,
                    timestamp,
                    user_message,
                    ai_message,
                  });
          
                  return acc;
                }, {});
          
                // Convert grouped feedback to an array for the response
                const organizedFeedback = Object.values(groupedFeedback);
          
                response.statusCode = 200;
                response.body = JSON.stringify(organizedFeedback);
              }
            } catch (err) {
              response.statusCode = 500;
              console.error(err);
              response.body = JSON.stringify({ error: "Internal server error" });
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
