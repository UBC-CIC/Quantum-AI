import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Box, Typography, Paper, Grid } from "@mui/material";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  MRT_TableContainer,
  useMaterialReactTable,
} from "material-react-table";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import UserHeader from "../../components/UserHeader";

function titleCase(str) {
  if (typeof str !== 'string') {
    return str;
  }
  return str.split(' ').map(function(word) {
    return word.charAt(0).toUpperCase() + word.slice(1); // Capitalize only the first letter, leave the rest of the word unchanged
  }).join(' ');
}

const AdminManageTopics = () => {
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTopics = async () => {
      setLoading(true);

      try {
        const session = await fetchAuthSession();
        const token = session.tokens.idToken
        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }user/topics`,
          {
            method: "GET",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          const sortedTopics = data.filter(topic => topic.topic_name !== "General").sort((a, b) => a.topic_name.localeCompare(b.topic_name));
          setTopics(sortedTopics);
        } else {
          console.error("Failed to fetch topics:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching topics:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTopics();
  }, []);

  const columns = useMemo(
    () => [
      {
        accessorKey: "topic_name",
        header: "Topic Name",
        Cell: ({ cell }) => titleCase(cell.getValue())
      },
      {
        accessorKey: "actions",
        header: "Actions",
        Cell: ({ row }) => (
          <Button
            variant="contained"
            sx={{
              backgroundColor: "#2E8797",
              color: "white",
              "&:hover": { backgroundColor: "#114153" },
            }}
            onClick={() => handleEditClick(row.original)}
          >
            Edit
          </Button>
        ),
      },
    ],
    []
  );

  const table = useMaterialReactTable({
    autoResetPageIndex: false,
    columns,
    data: topics,
    enableSorting: true,
    initialState: { pagination: { pageSize: 1000, pageIndex: 1 } },
  });

  const handleEditClick = (topicData) => {
    navigate(`/manage-topics/edit/${topicData.topic_id}`, {
      state: { topicData },
    });
  };

  const handleCreateTopicClick = () => {
    navigate(`/manage-topics/new`);
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
            >
              Manage Topics
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
            <Button
              variant="contained"
              onClick={handleCreateTopicClick}
              sx={{
                backgroundColor: "#2E8797",
                color: "white",
                "&:hover": { backgroundColor: "#114153" },
              }}
            >
              Create New Topic
            </Button>
          </Box>
            <Paper sx={{ width: "100%", overflow: "hidden", marginTop: 2 }}>
              <Box sx={{ maxHeight: "400px", overflowY: "auto" }}>
                <MRT_TableContainer table={table} />
              </Box>
            </Paper>
            <ToastContainer
              position="top-center"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="colored"
            />
          </Box>
        )}
    </div>
  );
};

export default AdminManageTopics;
