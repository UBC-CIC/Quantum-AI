import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#2E8797",
      // contrastText: "#ffffff",
    },
    secondary: {
      main: "#114153",
      contrastText: "#ffffff",
    },
    background: {
      main: "#F8F9FD",
      default: "#00000",
    },
    red: {
      main: "#cc0c0c",
    },
    default: {
      main: "#fffff",
    },
  },
  typography: {
    fontFamily: "Roboto, sans-serif",
    h1: {
      fontSize: "2rem",
    },
  },
});

export default theme;
