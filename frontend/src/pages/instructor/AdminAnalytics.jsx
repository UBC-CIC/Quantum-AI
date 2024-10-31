import React, { useState, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Container,
  Typography,
  Box,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Grid,
  Paper,
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

const AdminAnalytics = ({ courseName, course_id }) => {
  const [value, setValue] = useState(0);
  const [graphData, setGraphData] = useState([]);
  const [data, setData] = useState([]);
  const [maxMessages, setMaxMessages] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const session = await fetchAuthSession();
        const token = session.tokens.idToken
        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }instructor/analytics?course_id=${encodeURIComponent(course_id)}`,
          {
            method: "GET",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          }
        );
        if (response.ok) {
          const analytics_data = await response.json();
          setData(analytics_data);
          const graphDataFormatted = analytics_data.map((module) => ({
            module: module.module_name,
            Messages: module.message_count,
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

    fetchAnalytics();
  }, [course_id]);

  useEffect(() => {
    if (graphData.length > 0) {
      const max = Math.max(...graphData.map((data) => data.Messages));
      setMaxMessages(max);
    }
  }, [graphData]);

  const handleChange = (event, newValue) => {
    setValue(newValue);
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
            <l-quantum size="45" speed="1.75" color="white" />
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
                  Message Count
                </Typography>
                {graphData.length > 0 ? (
                  <LineChart
                    width={900}
                    height={300}
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
              aria-label="grade tabs"
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
            </Tabs>

            {value === 0 ? (
              data.length > 0 ? (
                <Box mt={2}>
                  {data.map((module, index) => (
                    <Accordion key={index}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography>{titleCase(module.module_name)}</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box width="100%">
                          <Grid
                            container
                            spacing={1}
                            alignItems="center"
                            direction="column"
                          >
                            <Grid item width="80%">
                              <Typography textAlign="right">
                                Completion Percentage:{" "}
                                {module.perfect_score_percentage.toFixed(2)}%
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={module.perfect_score_percentage}
                              />
                            </Grid>
                            <Grid item>
                              <Typography>Message Count</Typography>
                              <Typography>{module.message_count}</Typography>
                            </Grid>
                            <Grid item>
                              <Typography>Access Count</Typography>
                              <Typography>{module.access_count}</Typography>
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
            ) : null}
          </Box>
        )}
    </div>
  );
};

export default AdminAnalytics;
