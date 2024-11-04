import "./App.css";
// amplify
import { Amplify } from "aws-amplify";
import { fetchAuthSession } from "aws-amplify/auth";
import "@aws-amplify/ui-react/styles.css";
// react-router
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { useEffect, useState, createContext } from "react";
// pages
import Login from "./pages/Login";
import UserChat from "./pages/student/UserChat";
import AdminManageTopics from "./pages/instructor/AdminManageTopics";
import AdminEditTopic from "./pages/instructor/AdminEditTopic";
import AdminNewTopic from "./pages/instructor/AdminNewTopic";
import AdminAnalytics from "./pages/instructor/AdminAnalytics";

export const UserContext = createContext();

Amplify.configure({
  API: {
    REST: {
      MyApi: {
        endpoint: import.meta.env.VITE_API_ENDPOINT,
      },
    },
  },
  Auth: {
    Cognito: {
      region: import.meta.env.VITE_AWS_REGION,
      userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      allowGuestAccess: false,
    },
  },
});

function App() {
  const [user, setUser] = useState(null);
  const [userGroup, setUserGroup] = useState(null);

  useEffect(() => {
    const fetchAuthData = () => {
      fetchAuthSession()
        .then(({ tokens }) => {
          if (tokens && tokens.accessToken) {
            const group = tokens.accessToken.payload["cognito:groups"];
            setUser(tokens.accessToken.payload);
            setUserGroup(group || []);
          }
        })
        .catch((error) => {
          console.log(error);
        });
    };

    fetchAuthData();
  }, []);

  const getHomePage = () => {
    if (userGroup && userGroup.includes("admin")) {
      return <UserChat admin="true" />;
    } else if (userGroup && userGroup.includes("user")) {
      return <UserChat />;
    } else {
      return <Login />;
    }
  };

  const getManageTopicsPage = () => {
    if (userGroup && userGroup.includes("admin")) {
      return <AdminManageTopics />;
    } else {
      return <Navigate to="/home" />;
    }
  };

  const getEditTopicPage = () => {
    if (userGroup && userGroup.includes("admin")) {
      return <AdminEditTopic />;
    } else {
      return <Navigate to="/home" />;
    }
  };

  const getNewTopicPage = () => {
    if (userGroup && userGroup.includes("admin")) {
      return <AdminNewTopic />;
    } else {
      return <Navigate to="/home" />;
    }
  }

  const getAnalyticsPage = () => {
    if (userGroup && userGroup.includes("admin")) {
      return <AdminAnalytics />;
    } else {
      return <Navigate to="/home" />;
    }
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={user ? <Navigate to="/home" /> : <Login />}
        />
        <Route path="/home/*" element={getHomePage()} />
        <Route path="/manage-topics/*" element={getManageTopicsPage()} />
        <Route path="/manage-topics/edit/:topicId" element={getEditTopicPage()} />
        <Route path="/manage-topics/new" element={getNewTopicPage()} />
        <Route path="/analytics/*" element={getAnalyticsPage()} />
      </Routes>
    </Router>
  );
}

export default App;
