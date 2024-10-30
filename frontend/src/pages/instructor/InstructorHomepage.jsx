import React, { useState, useEffect, useContext } from "react";
import {
  Routes,
  Route,
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";
import { fetchAuthSession, fetchUserAttributes } from "aws-amplify/auth";
import {
  Typography,
  Box,
  AppBar,
  Toolbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  TableFooter,
  TablePagination,
  Button,
} from "@mui/material";
import PageContainer from "../Container";
import InstructorHeader from "../../components/InstructorHeader";
import InstructorSidebar from "./InstructorSidebar";
import InstructorAnalytics from "./AdminAnalytics";
import InstructorEditCourse from "./AdminEditTopic";
import PromptSettings from "./PromptSettings";
import ViewStudents from "./ViewStudents";
import InstructorModules from "./InstructorModules";
import InstructorNewModule from "./AdminNewTopic";
import StudentDetails from "./StudentDetails";
import InstructorNewConcept from "./InstructorNewConcept";
import InstructorConcepts from "./AdminManageDocuments";
import InstructorEditConcept from "./InstructorEditConcept";
import { UserContext } from "../../App";
function titleCase(str) {
  if (typeof str !== "string") {
    return str;
  }
  return str
    .toLowerCase()
    .split(" ")
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

// course details page
const CourseDetails = () => {
  const location = useLocation();
  const { courseName } = useParams();
  const [selectedComponent, setSelectedComponent] = useState(
    "InstructorAnalytics"
  );
  const { course_id } = location.state;

  const renderComponent = () => {
    switch (selectedComponent) {
      case "InstructorAnalytics":
        return (
          <InstructorAnalytics courseName={courseName} course_id={course_id} />
        );
      case "InstructorEditCourse":
        return (
          <InstructorModules courseName={courseName} course_id={course_id} />
        );
      case "InstructorEditConcepts":
        return (
          <InstructorConcepts courseName={courseName} course_id={course_id} setSelectedComponent={setSelectedComponent}/>
        );
      case "PromptSettings":
        return <PromptSettings courseName={courseName} course_id={course_id} />;
      case "ViewStudents":
        return <ViewStudents courseName={courseName} course_id={course_id} />;
      default:
        return (
          <InstructorAnalytics courseName={courseName} course_id={course_id} />
        );
    }
  };

  return (
    <PageContainer>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
        elevation={1}
      >
        <InstructorHeader />
      </AppBar>
      <InstructorSidebar setSelectedComponent={setSelectedComponent} />
      {renderComponent()}
    </PageContainer>
  );
};

const InstructorHomepage = () => {
  const [rows, setRows] = useState([
    {
      course: "loading...",
      date: "loading...",
      status: "loading...",
      id: "loading...",
    },
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [courseData, setCourseData] = useState([]);
  const { isInstructorAsStudent } = useContext(UserContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (isInstructorAsStudent) {
      navigate("/");
    }
  }, [isInstructorAsStudent, navigate]);
  // connect to api data
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const session = await fetchAuthSession();
        var token = session.tokens.idToken
        const { email } = await fetchUserAttributes();
        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }instructor/courses?email=${encodeURIComponent(email)}`,
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
          setCourseData(data);
          const formattedData = data.map((course) => ({
            course: course.course_name,
            date: new Date().toLocaleDateString(), // REPLACE
            status: course.course_student_access ? "Active" : "Inactive",
            id: course.course_id,
          }));
          setRows(formattedData);
        } else {
          console.error("Failed to fetch courses:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching courses:", error);
      }
    };

    fetchCourses();
  }, []);

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const filteredRows = rows.filter((row) =>
    row.course.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRowClick = (courseName, course_id) => {
    const course = courseData.find(
      (course) => course.course_name.trim() === courseName.trim()
    );

    if (course) {
      const { course_id, course_department, course_number } = course;
      const path = `/course/${course_department} ${course_number} ${courseName.trim()}`;
      navigate(path, { state: { course_id } });
    } else {
      console.error("Course not found!");
    }
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <PageContainer>
            <AppBar
              position="fixed"
              sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
              elevation={1}
            >
              <InstructorHeader />
            </AppBar>
            <Box component="main" sx={{ flexGrow: 1, p: 3, marginTop: 1 }}>
              <Toolbar />
              <Typography
                color="black"
                fontStyle="semibold"
                textAlign="left"
                variant="h6"
              >
                Courses
              </Typography>
              <Paper
                sx={{
                  width: "80%",
                  overflow: "hidden",
                  margin: "0 auto",
                  padding: 2,
                }}
              >
                <TextField
                  label="Search by Course"
                  variant="outlined"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  sx={{ width: "100%", marginBottom: 2 }}
                />
                <TableContainer sx={{ width: "100%", maxHeight: "70vh",
              overflowY: "auto",}}>
                  <Table aria-label="course table">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: "60%", padding: "16px" }}>
                          Course
                        </TableCell>
                        <TableCell sx={{ width: "20%", padding: "16px" }}>
                          Status
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredRows
                        .slice(
                          page * rowsPerPage,
                          page * rowsPerPage + rowsPerPage
                        )
                        .map((row, index) => (
                          <TableRow
                            key={index}
                            onClick={() => handleRowClick(row.course, row.id)}
                            style={{ cursor: "pointer" }}
                          >
                            <TableCell sx={{ padding: "16px" }}>
                              {titleCase(row.course)}
                            </TableCell>
                            <TableCell sx={{ padding: "16px" }}>
                              <Button
                                variant="contained"
                                color={
                                  row.status === "Active"
                                    ? "primary"
                                    : "secondary"
                                }
                              >
                                {row.status}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TablePagination
                          rowsPerPageOptions={[5, 10, 25]}
                          component="div"
                          count={filteredRows.length}
                          rowsPerPage={rowsPerPage}
                          page={page}
                          onPageChange={handleChangePage}
                          onRowsPerPageChange={handleChangeRowsPerPage}
                        />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          </PageContainer>
        }
      />
      <Route exact path=":courseName/*" element={<CourseDetails />} />
      <Route
        path=":courseName/edit-module/:moduleId"
        element={<InstructorEditCourse />}
      />
      <Route
        path=":courseName/edit-concept/:conceptId"
        element={<InstructorEditConcept />}
      />
      <Route path=":courseName/new-module" element={<InstructorNewModule />} />
      <Route
        path=":courseName/new-concept"
        element={<InstructorNewConcept />}
      />
      <Route
        path=":courseName/student/:studentId"
        element={<StudentDetails />}
      />
    </Routes>
  );
};

export default InstructorHomepage;
