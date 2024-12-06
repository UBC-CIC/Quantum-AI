import { useState, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Typography,
  Box,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Paper,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import UserHeader from "../../components/UserHeader";
import { quantum } from 'ldrs'

quantum.register()

function titleCase(str) {
  if (typeof str !== "string") {
    return str;
  }
  return str
    .split(" ")
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1); // Capitalize only the first letter, leave the rest of the word unchanged
    })
    .join(" ");
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString(); // This will convert to local time
}

const AdminAnalytics = () => {
  const [value, setValue] = useState(0);
  const [graphData, setGraphData] = useState([]);
  const [data, setData] = useState([]);
  const [maxMessages, setMaxMessages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [feedbackData, setFeedbackData] = useState([]);
  const [filterRating, setFilterRating] = useState("all");

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const session = await fetchAuthSession();
        const token = session.tokens.idToken
        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }admin/analytics`,
          {
            method: "GET",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          }
        );
        if (response.ok) {
          const analyticsData = await response.json();
          const sortedAnalyticsData = analyticsData.sort((a, b) => {
            if (a.topic_name === "General") return -1; // Move "General" to the top
            if (b.topic_name === "General") return 1;
            return 0;
          });
          
          setData(sortedAnalyticsData);
          const graphDataFormatted = sortedAnalyticsData.map((topic) => ({
            module: topic.topic_name,
            Messages: topic.user_message_count,
          }));
          setGraphData(graphDataFormatted);
        } else {
          console.error("Failed to fetch analytics:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching analytics:", error);
      }
      setLoading(false);
    };

    const fetchFeedback = async () => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens.idToken
        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }admin/feedback`,
          {
            method: "GET",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          }
        );
        if (response.ok) {
          const feedbackData = await response.json();
          const sortedFeedbackData = feedbackData.sort((a, b) => {
            if (a.topic_name === "General") return -1;
            if (b.topic_name === "General") return 1;
            return 0;
          });
          
          setFeedbackData(sortedFeedbackData);
        } else {
          console.error("Failed to fetch feedback:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching feedback:", error);
      }
    };

    fetchAnalytics();
    fetchFeedback();
  }, []);

  useEffect(() => {
    if (graphData.length > 0) {
      const max = Math.max(...graphData.map((data) => data.Messages));
      setMaxMessages(max);
    }
  }, [graphData]);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    
    return `${minutes}m ${remainingSeconds}s`;
  }

  const handleFilterChange = (event) => {
    setFilterRating(event.target.value);
  };

  const filteredFeedback = (feedback) => {
    if (filterRating === "all") return feedback;
    return feedback.filter((item) => item.feedback_rating === parseInt(filterRating));
  };

  return (
    <div className="flex h-screen">
      {loading ? (
          <Grid
            container
            justifyContent="center"
            alignItems="center"
            sx={{ height: "100vh", backgroundColor: "#2E8797" }}
          >
            <l-quantum size="45" speed="1.75" color="white"></l-quantum>
          </Grid>
        ) : (
          <Box
            component="main"
            sx={{ flexGrow: 1, px: 2, overflow: "auto", backgroundColor: "#F8F9FD" }}
          >      
            <div className="w-full">
              <UserHeader admin={true}/>
            </div>
            <Typography
              color="black"
              fontStyle="bold"
              textAlign="left"
              variant="h4"
              gutterBottom
            >
              Analytics
            </Typography>
            <Paper>
              <Box mb={4}>
                <Typography
                  color="black"
                  textAlign="left"
                  paddingLeft={10}
                  padding={2}
                >
                  User Message Count
                </Typography>
                {graphData.length > 0 ? (
                  <LineChart
                    width={1000}
                    height={400}
                    data={graphData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="module"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(tick) => titleCase(tick)}
                    />
                    <YAxis domain={[0, maxMessages + 3]} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="Messages"
                      stroke="#114153"
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                ) : (
                  <Typography
                    variant="h6"
                    color="textSecondary"
                    textAlign="center"
                    padding={4}
                  >
                    No data found
                  </Typography>
                )}
              </Box>
            </Paper>

            <Tabs 
              value={value} 
              onChange={handleChange} 
              aria-label="analytics tabs"
              sx={{
                "& .MuiTab-root": {
                  color: "#2E8797", // Default color of the tabs
                },
                "& .Mui-selected": {
                  color: "#2E8797", // Color when a tab is selected
                },
              }} 
            >
              <Tab label="Insights" />
              <Tab label="Feedback" />
            </Tabs>

            {value === 0 && (
              data.length > 0 ? (
                <Box mt={2} mb={4}>
                  {data.map((topic, index) => (
                    <Accordion key={index}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle1">{topic.topic_name}</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box width="100%">
                          <Grid
                            container
                            justifyContent="space-between" // Add space between grid items
                            alignItems="center"
                            direction="row"
                            sx={{ px: 4, py: 2 }} // Adds padding on the left and right
                          >
                            <Grid item>
                              <Typography variant="subtitle2">User Message Count</Typography>
                              <Typography variant="subtitle2">{topic.user_message_count}</Typography>
                            </Grid>
                            <Grid item>
                              <Typography variant="subtitle2">AI Message Count</Typography>
                              <Typography variant="subtitle2">{topic.ai_message_count}</Typography>
                            </Grid>
                            <Grid item>
                              <Typography variant="subtitle2">Average Session Time</Typography>
                              <Typography variant="subtitle2">{formatTime(topic.average_session_time)}</Typography>
                            </Grid>
                            <Grid item>
                              <Typography variant="subtitle2">Total Session Time</Typography>
                              <Typography variant="subtitle2">{formatTime(topic.total_session_time)}</Typography>
                            </Grid>
                            <Grid item>
                              <Typography variant="subtitle2">Active Sessions</Typography>
                              <Typography variant="subtitle2">{topic.sessions_created - topic.sessions_deleted}</Typography>
                            </Grid>
                            <Grid item>
                              <Typography variant="subtitle2">Sessions Created</Typography>
                              <Typography variant="subtitle2">{topic.sessions_created}</Typography>
                            </Grid>
                            <Grid item>
                              <Typography variant="subtitle2">Sessions Deleted</Typography>
                              <Typography variant="subtitle2">{topic.sessions_deleted}</Typography>
                            </Grid>
                          </Grid>
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
              ) : (
                <Typography
                  variant="h6"
                  color="textSecondary"
                  textAlign="center"
                  padding={4}
                >
                  No insights available
                </Typography>
              )
            )}

            {value === 1 && (
              feedbackData.length > 0 ? (
                <Box mt={2} mb={4}>
                  {feedbackData.map((topic, index) => (
                    <Accordion key={index}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle1">{titleCase(topic.topic_name)}</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography
                          variant="h4"
                          sx={{ mb: 2, fontWeight: 'bold' }}
                        >
                          {topic.average_rating.toFixed(1)}
                        </Typography>
                        <Typography variant="subtitle2" sx={{ mb: 2 }}>
                          Average Rating (out of 5)
                        </Typography>
                        <FormControl sx={{ mb: 2, minWidth: 120 }}>
                          <InputLabel id="rating-filter-label">Filter by Rating</InputLabel>
                          <Select
                            labelId="rating-filter-label"
                            id="rating-filter"
                            value={filterRating}
                            label="Filter by Rating"
                            onChange={handleFilterChange}
                          >
                            <MenuItem value="all">All Ratings</MenuItem>
                            <MenuItem value="1">1 Star</MenuItem>
                            <MenuItem value="2">2 Stars</MenuItem>
                            <MenuItem value="3">3 Stars</MenuItem>
                            <MenuItem value="4">4 Stars</MenuItem>
                            <MenuItem value="5">5 Stars</MenuItem>
                          </Select>
                        </FormControl>
                        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                          {filteredFeedback(topic.feedback).map((feedback) => (
                            <Card key={feedback.feedback_id} sx={{ mb: 2 }}>
                              <CardHeader
                                title={
                                  <Typography variant="body2">
                                    Rating: {feedback.feedback_rating}/5
                                  </Typography>
                                }
                                subheader={
                                  <Typography variant="caption">
                                    {formatDate(feedback.timestamp)}
                                  </Typography>
                                }
                              />
                              <CardContent>
                                <Typography variant="body2" sx={{ mb: 1 }}>Feedback: {feedback.feedback_description}</Typography>
                                <Typography variant="body2" align="left" sx={{ mb: 1 }}>User Message: {feedback.user_message}</Typography>
                                <Typography variant="body2" align="left">AI Response: {feedback.ai_message}</Typography>
                              </CardContent>
                            </Card>
                          ))}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
              ) : (
                <Typography
                  variant="h6"
                  color="textSecondary"
                  textAlign="center"
                  padding={4}
                >
                  No feedback available
                </Typography>
              )
            )}
          </Box>
        )}
    </div>
  );
};

export default AdminAnalytics;