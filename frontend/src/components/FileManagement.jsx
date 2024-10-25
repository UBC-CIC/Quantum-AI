import { useState } from "react";
import {
  Button,
  Typography,
  IconButton,
  Card,
  CardContent,
  Box,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHead,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const FileManagement = ({
  newFiles,
  setNewFiles,
  files,
  setFiles,
  setDeletedFiles,
  savedFiles,
  setSavedFiles,
  loading,
  metadata,
  setMetadata,
}) => {
  const [duplicateFile, setDuplicateFile] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleMetadataChange = (fileName, value) => {
    setMetadata((prev) => ({ ...prev, [fileName]: value }));
  };

  const handleDownloadClick = (url) => {
    console.log(url.url)
    window.open(url.url, "_blank");
  };

  const cleanFileName = (fileName) => {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  };

  const handleFileUpload = async (event) => {
    const uploadedFiles = Array.from(event);
    const existingFileNames = files.map((file) => file.fileName);
    const savedFileNames = savedFiles.map((file) => file.name);
    const newFileNames = newFiles.map((file) => file.name);
    const allFileNames = [
      ...existingFileNames,
      ...savedFileNames,
      ...newFileNames,
    ];

    const fileIsNew = uploadedFiles.filter((file) => {
      const cleanedFileName = cleanFileName(file.name);
      if (allFileNames.includes(cleanedFileName)) {
        setDuplicateFile(file);
        setIsDialogOpen(true);
        return false;
      }
      return true;
    });

    // Filter out files larger than 500MB
    const fileIsValidSize = fileIsNew.filter((file) => {
      const fileSizeMB = file.size / (1024 * 1024); // Convert size to MB
      if (fileSizeMB > 500) {
        toast.error(
          `File ${file.name} is larger than 500MB and was not uploaded.`,
          {
            position: "top-center",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "colored",
          }
        );
        return false;
      }
      return true;
    });

    setNewFiles([...newFiles, ...fileIsValidSize]);
  };

  const handleConfirmReplace = () => {
    const cleanedFileName = cleanFileName(duplicateFile.name);

    // Move existing file to deleted files and add the new file to newFiles
    const updatedFiles = files.filter(
      (file) => file.fileName !== cleanedFileName
    );
    const updatedSavedFiles = savedFiles.filter(
      (file) => file.name !== cleanedFileName
    );
    const updatedNewFiles = newFiles.filter(
      (file) => file.name !== cleanedFileName
    );
    setFiles(updatedFiles);
    setSavedFiles(updatedSavedFiles);
    setNewFiles([...updatedNewFiles, duplicateFile]);
    setDeletedFiles((prevDeletedFiles) => [
      ...prevDeletedFiles,
      cleanedFileName,
    ]);
    setDuplicateFile(null);
    setIsDialogOpen(false);
  };

  const handleCancelReplace = () => {
    setDuplicateFile(null);
    setIsDialogOpen(false);
  };

  const handleDownloadFile = (file) => {
    const url = window.URL.createObjectURL(new Blob([file]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", file.name);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  };

  const handleRemoveFile = async (file_name) => {
    setDeletedFiles((prevDeletedFiles) => [...prevDeletedFiles, file_name]);
    const updatedFiles = files.filter((file) => file.fileName !== file_name);
    setFiles(updatedFiles);
  };

  const handleSavedRemoveFile = async (file_name) => {
    setDeletedFiles((prevDeletedFiles) => [...prevDeletedFiles, file_name]);
    const updatedFiles = savedFiles.filter((file) => file.name !== file_name);
    setSavedFiles(updatedFiles);
  };

  const handleRemoveNewFile = (file_name) => {
    const updatedFiles = newFiles.filter((file) => file.name !== file_name);
    setNewFiles(updatedFiles);
  };

  return (
    <Box sx={{ border: 1, borderRadius: 3, borderColor: "grey.400", p: 1 }}>
      <Typography variant="h6" sx={{ pt: 1 }}>
        Files
      </Typography>
      <Card
        variant="outlined"
        component="label"
        sx={{ textAlign: "center", p: 0, cursor: "pointer" }}
      >
        <CardContent
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <input
            accept=".pdf,.docx,.pptx,.txt,.xlsx,.xps,.mobi,.cbz"
            type="file"
            multiple
            hidden
            onChange={(e) => handleFileUpload(e.target.files)}
          />
          <IconButton
            color="primary"
            aria-label="upload files"
            component="span"
          >
            <CloudUploadIcon sx={{ fontSize: 40 }} />
          </IconButton>
          <Typography variant="body1" color="textSecondary">
            Click to upload file
          </Typography>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onClose={handleCancelReplace}>
        <DialogTitle>File Exists</DialogTitle>
        <DialogContent>
          <DialogContentText>
            A file with the name "{duplicateFile?.name}" already exists. Do you
            want to replace it?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelReplace} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmReplace} color="primary">
            Replace
          </Button>
        </DialogActions>
      </Dialog>

      <Typography variant="h7" fontWeight={"bold"} sx={{ pb: 3 }}>
        Uploaded Files
      </Typography>
      {!loading ? (
        <Box sx={{ ml: 8, mr: 8 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell align="center">File Name</TableCell>
                <TableCell align="center">File Description</TableCell>{" "}
                <TableCell align="right" sx={{ pr: 5 }}>
                  Download
                </TableCell>
                <TableCell align="right">Remove</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...files, ...savedFiles, ...newFiles].length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" align="center">
                      No files found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                [...files, ...savedFiles, ...newFiles]
                  .sort((a, b) => {
                    if (newFiles.includes(a) && !newFiles.includes(b)) return 1;
                    if (!newFiles.includes(a) && newFiles.includes(b))
                      return -1;

                    const nameA = a.fileName || a.name;
                    const nameB = b.fileName || b.name;

                    if (nameA < nameB) return -1;
                    if (nameA > nameB) return 1;

                    return 0;
                  })
                  .map((file, index) => {
                    const fileName = file.fileName || file.name;
                    return (
                      <TableRow key={index}>
                        <TableCell align="center">
                          <Typography
                            variant="body2"
                            sx={{
                              color: newFiles.includes(file)
                                ? "#db1212"
                                : "inherit",
                            }}
                          >
                            {cleanFileName(fileName)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <TextField
                            variant="outlined"
                            fullWidth
                            placeholder="Enter File Description"
                            multiline
                            maxRows={4}
                            value={metadata[fileName] || ""}
                            onChange={(e) =>
                              handleMetadataChange(fileName, e.target.value)
                            }
                            inputProps={{ maxLength: 100 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            variant="contained"
                            color="primary"
                            onClick={() => {
                              if (file && file.url && file.url !== "dummy")
                                handleDownloadClick(file.url);
                              else handleDownloadFile(file);
                            }}
                          >
                            Download
                          </Button>
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            aria-label="delete"
                            onClick={() => {
                              if (newFiles.includes(file))
                                handleRemoveNewFile(fileName);
                              else if (savedFiles.includes(file))
                                handleSavedRemoveFile(fileName);
                              else handleRemoveFile(fileName);
                            }}
                          >
                            <DeleteIcon color="error" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })
              )}
            </TableBody>
          </Table>
        </Box>
      ) : (
        <Typography variant="body2">Loading...</Typography>
      )}
    </Box>
  );
};

export default FileManagement;
