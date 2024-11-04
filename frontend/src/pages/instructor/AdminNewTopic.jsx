import { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { fetchAuthSession } from "aws-amplify/auth";

import {
  TextField,
  Button,
  Paper,
  Typography,
  Grid,
  Box
} from "@mui/material";
import PageContainer from "../Container";
import FileManagement from "../../components/FileManagement";

export const AdminNewTopic = () => {
  const [files, setFiles] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [savedFiles, setSavedFiles] = useState([]);
  const [deletedFiles, setDeletedFiles] = useState([]);
  const [metadata, setMetadata] = useState({});

  const [isSaving, setIsSaving] = useState(false);
  const [topicName, setTopicName] = useState("");
  const [prompt, setPrompt] = useState("");

  const cleanFileName = (fileName) => {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  };
  const handleBackClick = () => {
    window.history.back();
  };

  function removeFileExtension(fileName) {
    return fileName.replace(/\.[^/.]+$/, "");
  }

  const getFileType = (filename) => {
    const parts = filename.split(".");
    if (parts.length > 1) {
      return parts.pop();
    } else {
      return "";
    }
  };

  const handleInputChange = (e) => {
    setTopicName(e.target.value);
  };

  const handlePromptChange = (e) => {
    setPrompt(e.target.value);
  };

  const uploadFiles = async (newFiles, token, topicId) => {
    const newFilePromises = newFiles.map((file) => {
      const fileType = getFileType(file.name);
      const fileName = cleanFileName(removeFileExtension(file.name));
      return fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }admin/generate_presigned_url?topic_id=${encodeURIComponent(
          topicId
        )}&file_type=${encodeURIComponent(
          fileType
        )}&file_name=${encodeURIComponent(fileName)}`,
        {
          method: "GET",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      )
        .then((response) => response.json())
        .then((presignedUrl) => {
          return fetch(presignedUrl.presignedurl, {
            method: "PUT",
            headers: {
              "Content-Type": file.type,
            },
            body: file,
          });
        });
    });

    return await Promise.all(newFilePromises);
  };

  const handleSave = async () => {
    if (isSaving) return;

    // Validation check
    if (!topicName || !prompt) {
      toast.error("Module Name and Prompt are required.", {
        position: "top-center",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      return;
    }

    setIsSaving(true);

    try {
      const session = await fetchAuthSession();
      const token = session.tokens.idToken
      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }admin/create_topic?topic_name=${encodeURIComponent(
          topicName
        )}`,
        {
          method: "POST",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            system_prompt: prompt,
          }),
        }
      );
      if (!response.ok) {
        console.error(`Failed to create topic`, response.statusText);
        toast.error("Topic Creation Failed", {
          position: "top-center",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
      } else {
        const updatedTopic = await response.json();
        await uploadFiles(newFiles, token, updatedTopic.topic_id);

        setFiles((prevFiles) =>
          prevFiles.filter((file) => !deletedFiles.includes(file.fileName))
        );
        setSavedFiles((prevFiles) => [...prevFiles, ...newFiles]);

        setDeletedFiles([]);
        setNewFiles([]);
        toast.success("Topic Created Successfully", {
          position: "top-center",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
      }
    } catch (error) {
      console.error("Error saving changes:", error);
    } finally {
      setIsSaving(false);
      setTimeout(function () {
        handleBackClick();
      }, 1000);
    }
  };

  return (
    <PageContainer>
      <Paper style={{ padding: 25, width: "100%", overflow: "auto" }}>
        <Typography variant="h4" textAlign="left">New Topic</Typography>

        <TextField
          label="Topic Name"
          name="name"
          value={topicName}
          onChange={handleInputChange}
          fullWidth
          margin="normal"
          inputProps={{ maxLength: 50 }}
        />
        
        <TextField
          label="Topic Prompt"
          name="prompt"
          value={prompt}
          onChange={handlePromptChange}
          fullWidth
          margin="normal"
          inputProps={{ maxLength: 2000 }}
          multiline
          rows={4} // You can adjust the number of rows as needed
        />
        {/* <Typography variant="body1" textAlign="left" sx={{ pb: 2 }} >
          Warning: Modifying the prompt in the text area above can significantly impact the quality and accuracy of the responses.
        </Typography> */}

        <FileManagement
          newFiles={newFiles}
          setNewFiles={setNewFiles}
          files={files}
          setFiles={setFiles}
          setDeletedFiles={setDeletedFiles}
          savedFiles={savedFiles}
          setSavedFiles={setSavedFiles}
          loading={false}
          metadata={metadata}
          setMetadata={setMetadata}
        />

        <Grid container spacing={2} style={{ marginTop: 16 }}>
          <Grid item xs={4}>
            <Box display="flex" gap={6}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleBackClick}
                sx={{ width: "30%" }}
              >
                Cancel
              </Button>
            </Box>
          </Grid>
          <Grid item xs={4}></Grid>
          <Grid item xs={4} style={{ textAlign: "right" }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              style={{ width: "40%" }}
            >
              Create Topic
            </Button>
          </Grid>
        </Grid>
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
    </PageContainer>
  );
};

export default AdminNewTopic;
