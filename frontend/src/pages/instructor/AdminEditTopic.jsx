import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { fetchAuthSession } from "aws-amplify/auth";
import { fetchUserAttributes } from "aws-amplify/auth";

import {
  TextField,
  Button,
  Paper,
  Typography,
  Grid,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from "@mui/material";
import PageContainer from "../Container";
import FileManagement from "../../components/FileManagement";
import { quantum } from 'ldrs'

quantum.register()

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

const AdminEditTopic = () => {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [metadata, setMetadata] = useState({});

  const [files, setFiles] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [savedFiles, setSavedFiles] = useState([]);
  const [deletedFiles, setDeletedFiles] = useState([]);

  const location = useLocation();
  const [topic, setTopic] = useState(null);
  const { topicData } = location.state || {};
  const [topicName, setTopicName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const handleBackClick = () => {
    window.history.back();
  };

  const handleDeleteConfirmation = () => {
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
  };

  const handleConfirmDelete = async () => {
    setDialogOpen(false);
    handleDelete();
  };

  function convertDocumentFilesToArray(files) {
    const documentFiles = files.document_files;
    const resultArray = Object.entries({
      ...documentFiles,
    }).map(([fileName, url]) => ({
      fileName,
      url,
    }));

    const metadata = resultArray.reduce((acc, { fileName, url }) => {
      acc[fileName] = url.metadata;
      return acc;
    }, {});

    setMetadata(metadata);
    return resultArray;
  }

  function removeFileExtension(fileName) {
    return fileName.replace(/\.[^/.]+$/, "");
  }
  const fetchFiles = async () => {
    try {
      const { token } = await getAuthSessionAndEmail();
      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }admin/get_all_files?topic_id=${encodeURIComponent(
          topic.topic_id
        )}`,
        {
          method: "GET",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );
      if (response.ok) {
        const fileData = await response.json();
        setFiles(convertDocumentFilesToArray(fileData));
      } else {
        console.error("Failed to fetch files:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching Files:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (topicData) {
      setTopic(topicData);
      setTopicName(topicData.topic_name);
      setPrompt(topicData.system_prompt);
    }
  }, [topicData]);

  useEffect(() => {
    if (topic) {
      fetchFiles();
    }
  }, [topic]);

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);

    try {
      const session = await fetchAuthSession();
      const token = session.tokens.idToken
      const s3Response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }admin/delete_topic_s3?topic_id=${encodeURIComponent(
          topic.topic_id
        )}`,
        {
          method: "DELETE",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );

      if (!s3Response.ok) {
        throw new Error("Failed to delete topic from S3");
      }
      const topicResponse = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }admin/delete_topic?topic_id=${encodeURIComponent(
          topic.topic_id
        )}`,
        {
          method: "DELETE",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );

      if (topicResponse.ok) {
        toast.success("Successfully Deleted", {
          position: "top-center",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
        setTimeout(() => {
          handleBackClick();
        }, 1000);
      } else {
        throw new Error("Failed to delete topic");
      }
    } catch (error) {
      setIsDeleting(false);
      console.error(error.message);
      toast.error("Failed to delete topic", {
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
  };

  const handleInputChange = (e) => {
    setTopicName(e.target.value);
  };

  const handlePromptChange = (e) => {
    setPrompt(e.target.value);
  };

  const getFileType = (filename) => {
    // Get the file extension by splitting the filename on '.' and taking the last part
    const parts = filename.split(".");

    // Check if there's at least one '.' in the filename and return the last part
    if (parts.length > 1) {
      return parts.pop();
    } else {
      return "";
    }
  };

  const updateTopic = async () => {
    const { token } = await getAuthSessionAndEmail();
    console.log("token", token);
    console.log("topic", topic);
    console.log("topicName", topicName);
    console.log("prompt", prompt);

    const editTopicResponse = await fetch(
      `${
        import.meta.env.VITE_API_ENDPOINT
      }admin/edit_topic?topic_id=${encodeURIComponent(
        topic.topic_id
      )}&topic_name=${encodeURIComponent(
        topicName
      )}`,
      {
        method: "PUT",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system_prompt: prompt,
        }),
      }
    );

    if (!editTopicResponse.ok) {
      throw new Error(editTopicResponse.statusText);
    }

    return editTopicResponse;
  };

  const deleteFiles = async (deletedFiles, token) => {
    const deletedFilePromises = deletedFiles.map((file_name) => {
      const fileType = getFileType(file_name);
      const fileName = cleanFileName(removeFileExtension(file_name));
      return fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }admin/delete_file?topic_id=${encodeURIComponent(
          topic.topic_id
        )}&file_type=${encodeURIComponent(
          fileType
        )}&file_name=${encodeURIComponent(fileName)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );
    });
  };

  const cleanFileName = (fileName) => {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  };

  const uploadFiles = async (newFiles, token) => {
    const successfullyUploadedFiles = [];
    // add meta data to this request
    const newFilePromises = newFiles.map(async (file) => {
      const fileType = getFileType(file.name);
      const fileName = cleanFileName(removeFileExtension(file.name));

      try {
        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }admin/generate_presigned_url?topic_id=${encodeURIComponent(
            topic.topic_id
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
        );

        if (!response.ok) {
          throw new Error("Failed to fetch presigned URL");
        }

        const presignedUrl = await response.json();
        const uploadResponse = await fetch(presignedUrl.presignedurl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload file");
        }

        // Add file to the successful uploads array
        successfullyUploadedFiles.push(file);
      } catch (error) {
        console.error(error.message);
      }
    });

    // Wait for all uploads to complete
    await Promise.all(newFilePromises);

    // Update state with successfully uploaded files
    setSavedFiles((prevFiles) => [...prevFiles, ...successfullyUploadedFiles]);
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    if (!topicName || !prompt) {
      toast.error("Topic Name and Prompt are required.", {
        position: "top-center",
        autoClose: 1000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      return;
    }
    try {
      await updateTopic();
      console.log("Updated Topic");
      const { token } = await getAuthSessionAndEmail();
      await deleteFiles(deletedFiles, token);
      console.log("deletedFiles", deletedFiles);
      await uploadFiles(newFiles, token);
      console.log("newFiles", newFiles);
      await Promise.all([
        updateMetaData(files, token),
        updateMetaData(savedFiles, token),
        updateMetaData(newFiles, token),
      ]);
      setFiles((prevFiles) =>
        prevFiles.filter((file) => !deletedFiles.includes(file.fileName))
      );

      setDeletedFiles([]);
      setNewFiles([]);
      toast.success("Topic updated successfully", {
        position: "top-center",
        autoClose: 1000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
    } catch (error) {
      console.error("Topic failed to update:", error);
      toast.error("Topic failed to update", {
        position: "top-center",
        autoClose: 1000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateMetaData = (files, token) => {
    files.forEach((file) => {
      const fileNameWithExtension = file.fileName || file.name;
      const fileMetadata = metadata[fileNameWithExtension] || "";
      const fileName = cleanFileName(
        removeFileExtension(fileNameWithExtension)
      );
      const fileType = getFileType(fileNameWithExtension);
      return fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }admin/update_metadata?topic_id=${encodeURIComponent(
          topic.topic_id
        )}&filename=${encodeURIComponent(
          fileName
        )}&filetype=${encodeURIComponent(fileType)}`,
        {
          method: "PUT",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ metadata: fileMetadata }),
        }
      );
    });
  };

  const getAuthSessionAndEmail = async () => {
    const session = await fetchAuthSession();
    const token = session.tokens.idToken
    const { email } = await fetchUserAttributes();
    return { token, email };
  };

  if (!topic) return 
  <Grid
    container
    justifyContent="center"
    alignItems="center"
    sx={{ height: "100vh", backgroundColor: "#2E8797" }}
  >
    <l-quantum size="45" speed="1.75" color="white"></l-quantum>
  </Grid>;

  return (
    <PageContainer>
      <Paper style={{ padding: 25, width: "100%", overflow: "auto" }}>
        <Typography variant="h4" textAlign="left" sx={{ pb: 2 }}>
          Edit {titleCase(topic.topic_name)}{" "}
        </Typography>

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
          loading={loading}
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
                sx={{ width: "30%", maxHeight: "40px" }}
                disabled={isSaving || isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleDeleteConfirmation}
                sx={{ width: "40%", maxHeight: "40px" }}
                disabled={isSaving || isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Topic"}
              </Button>
            </Box>
          </Grid>
          <Grid item xs={4}></Grid>
          <Grid item xs={4} style={{ textAlign: "right" }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              style={{ width: "40%", maxHeight: "40px" }}
              disabled={isSaving || isDeleting}
            >
              {isSaving ? "Saving..." : "Save Topic"}
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
      <Dialog open={dialogOpen} onClose={handleDialogClose}>
        <DialogTitle>{"Delete Topic"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this topic? This action cannot be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};

export default AdminEditTopic;
