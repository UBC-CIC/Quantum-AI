import { useEffect, useRef, useState } from "react";
import AIMessage from "../../components/AIMessage";
import Session from "../../components/Session";
import UserMessage from "../../components/UserMessage";
import UserHeader from "../../components/UserHeader";
import { fetchAuthSession } from "aws-amplify/auth";
import { fetchUserAttributes } from "aws-amplify/auth";
import { FaChevronDown } from "react-icons/fa";
import { GoSidebarExpand, GoSidebarCollapse } from "react-icons/go";
import { IoSend } from "react-icons/io5";
import logo from "../../assets/logo.png";
import {
  Grid,
  Box,
  Typography,
} from "@mui/material";
import { quantum } from 'ldrs'

quantum.register()

const TypingIndicator = () => (
  <div className="flex items-center ml-20 mb-4">
    <l-quantum size="45" speed="1.75" color="#2E8797"></l-quantum>
    <span className="ml-2 text-gray-500">Quantum AI is typing...</span>
  </div>
);

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

const UserChat = ({ admin }) => {
  const [name, setName] = useState("");
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState(null);
  const [previousSession, setPreviousSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [newMessage, setNewMessage] = useState(null);
  const [isAItyping, setIsAItyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [topics, setTopics] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [newSessionCreated, setNewSessionCreated] = useState(false);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (newMessage !== null) {
      if (currentSessionId === session.session_id) {
        setMessages((prevItems) => [...prevItems, newMessage]);
      }
      setNewMessage(null);
    }
  }, [session, newMessage, currentSessionId]);

  useEffect(() => {
    const fetchName = () => {
      setLoading(true);

      fetchAuthSession()
        .then((session) => {
          return fetchUserAttributes().then((userAttributes) => {
            const token = session.tokens.idToken
            const email = userAttributes.email;
            return fetch(
              `${
                import.meta.env.VITE_API_ENDPOINT
              }user/get_name?user_email=${encodeURIComponent(email)}`,
              {
                method: "GET",
                headers: {
                  Authorization: token,
                  "Content-Type": "application/json",
                },
              }
            );
          });
        })
        .then((response) => response.json())
        .then((data) => {
          setName(data.name);
        })
        .catch((error) => {
          console.error("Error fetching name:", error);
        }).finally(() => {
          setLoading(false);
        });
    };

    fetchName();
  }, []);

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
          // Move the "General" topic to the beginning, if it exists
          const sortedData = data.sort((a, b) => {
            if (a.topic_name === "General") return -1; // Move "General" to the top
            if (b.topic_name === "General") return 1;
            return 0;
          });
          setTopics(sortedData);
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

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);

      try {
        const session = await fetchAuthSession();
        const { email } = await fetchUserAttributes();
        const token = session.tokens.idToken
        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }user/sessions?email=${encodeURIComponent(
            email
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
          const data = await response.json();
          setSessions(data);
          setSession(data[data.length - 1]);
        } else {
          console.error("Failed to fetch sessions:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching sessions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  const getMostRecentUserMessageIndex = () => {
    const userMessages = messages
      .map((message, index) => ({ ...message, index }))
      .filter((message) => message.user_sent);
    return userMessages.length > 0
      ? userMessages[userMessages.length - 1].index
      : -1;
  };

  const hasAiMessageAfter = (messages, recentUserMessageIndex) => {
    return messages
      .slice(recentUserMessageIndex + 1)
      .some((message) => !message.user_sent);
  };

  async function retrieveKnowledgeBase(message, sessionId, topicId) {
    try {
      const authSession = await fetchAuthSession();
      const { email } = await fetchUserAttributes();
      const token = authSession.tokens.idToken
      try {
        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }user/create_ai_message?session_id=${encodeURIComponent(
            sessionId
          )}&email=${encodeURIComponent(
            email
          )}&topic_id=${encodeURIComponent(
            topicId
          )}`,
          {
            method: "POST",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message_content: message,
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          setNewMessage(data[0]);
        } else {
          console.error("Failed to retreive message:", response.statusText);
        }
      } catch (error) {
        console.error("Error retreiving message:", error);
      }
    } catch (error) {
      console.error("Error retrieving message from knowledge base:", error);
    }
  }

  function createUserSessionEngagementLog(sessionId, engagementType) {
    let userEmail;
    let authToken;

    return fetchAuthSession()
      .then((session) => {
        authToken = session.tokens.idToken
        return fetchUserAttributes();
      })
      .then(({ email }) => {
        userEmail = email;
        const url = `${
          import.meta.env.VITE_API_ENDPOINT
        }user/create_user_session_engagement_log?email=${encodeURIComponent(
          userEmail
        )}&session_id=${encodeURIComponent(
          sessionId
        )}&engagement_type=${encodeURIComponent(engagementType)}`;

        return fetch(url, {
          method: "POST",
          headers: {
            Authorization: authToken,
            "Content-Type": "application/json",
          },
        });
      })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to create user session engagement log: ${response.statusText}`);
        }
        return response.json();
      })
      .catch((error) => {
        console.error("Error creating user session engagement log:", error);
      })
  }

  const handleSubmit = () => {
    if (isSubmitting || isAItyping || creatingSession) return;
    setIsSubmitting(true);
    let newSession;
    let authToken;
    let userEmail;
    let messageContent = textareaRef.current.value.trim();
    let getSession;

    if (!messageContent) {
      console.warn("Message content is empty or contains only spaces.");
      setIsSubmitting(false);
      return;
    }
    if (session) {
      getSession = Promise.resolve(session);
    } else {
      if (!creatingSession) {
        setCreatingSession(true);
        handleNewChat();
      }
      setIsSubmitting(false);
      return;
    }

    getSession
      .then((retrievedSession) => {
        newSession = retrievedSession;
        setCurrentSessionId(newSession.session_id);
        return fetchAuthSession();
      })
      .then((authSession) => {
        authToken = authSession.tokens.idToken
        return fetchUserAttributes();
      })
      .then(({ email }) => {
        userEmail = email;
        const messageUrl = `${
          import.meta.env.VITE_API_ENDPOINT
        }user/create_message?session_id=${encodeURIComponent(
          newSession.session_id
        )}&email=${encodeURIComponent(
          userEmail
        )}&topic_id=${encodeURIComponent(
          newSession.topic_id
        )}`;

        return fetch(messageUrl, {
          method: "POST",
          headers: {
            Authorization: authToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message_content: messageContent,
          }),
        });
      })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to create message: ${response.statusText}`);
        }
        return response.json();
      })
      .then((messageData) => {
        setNewMessage(messageData[0]);
        setNewSessionCreated(false);
        setIsAItyping(true);
        textareaRef.current.value = "";

        const message = messageData[0].message_content;

        const textGenUrl = `${
          import.meta.env.VITE_API_ENDPOINT
        }user/text_generation?topic_id=${encodeURIComponent(
          session.topic_id
        )}&session_id=${encodeURIComponent(
          newSession.session_id
        )}&session_name=${encodeURIComponent(newSession.session_name)}`;

        return fetch(textGenUrl, {
          method: "POST",
          headers: {
            Authorization: authToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message_content: message,
          }),
        });
      })
      .then((textGenResponse) => {
        if (!textGenResponse.ok) {
          throw new Error(
            `Failed to generate text: ${textGenResponse.statusText}`
          );
        }
        return textGenResponse.json();
      })
      .then((textGenData) => {
        setSession((prevSession) => ({
          ...prevSession,
          session_name: textGenData.session_name,
        }));

        const updateSessionName = `${
          import.meta.env.VITE_API_ENDPOINT
        }user/update_session_name?session_id=${encodeURIComponent(
          newSession.session_id
        )}`;

        setSessions((prevSessions) => {
          return prevSessions.map((s) =>
            s.session_id === newSession.session_id
              ? { ...s, session_name: titleCase(textGenData.session_name) }
              : s
          );
        });

        return Promise.all([
          fetch(updateSessionName, {
            method: "PUT",
            headers: {
              Authorization: authToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              session_name: textGenData.session_name,
            }),
          }),
          textGenData,
        ]);
      })
      .then(([response1, response2]) => {
        if (!response1.ok) {
          throw new Error("Failed to fetch endpoints");
        }

        return retrieveKnowledgeBase(
          response2.llm_output,
          newSession.session_id,
          newSession.topic_id
        );
      })
      .catch((error) => {
        setIsSubmitting(false);
        setIsAItyping(false);
        console.error("Error:", error);
      })
      .finally(() => {
        setIsSubmitting(false);
        setIsAItyping(false);
      });
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleNewChat = (topic) => {
    let sessionData;
    let userEmail;
    let authToken;
    return fetchAuthSession()
      .then((session) => {
        authToken = session.tokens.idToken
        return fetchUserAttributes();
      })
      .then(({ email }) => {
        userEmail = email;
        const session_name = `New Chat - ${topic.topic_name}`;
        const url = `${
          import.meta.env.VITE_API_ENDPOINT
        }user/create_session?email=${encodeURIComponent(
          userEmail
        )}&topic_id=${encodeURIComponent(
          topic.topic_id
        )}&session_name=${encodeURIComponent(session_name)}`;

        return fetch(url, {
          method: "POST",
          headers: {
            Authorization: authToken,
            "Content-Type": "application/json",
          },
        });
      })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to create session: ${response.statusText}`);
        }
        return response.json();
      })
      .then((data) => {
        sessionData = data[0];
        setCurrentSessionId(sessionData.session_id);
        setSessions((prevItems) => [...prevItems, sessionData]);
        //set previous session to second last session if there is one
        console.log("Checking Sessions:", sessions);
        if (sessions.length > 0) {
          console.log("Setting previous session:", sessions[sessions.length - 1]);
          setPreviousSession(sessions[sessions.length - 1]);
        }
        setSession(sessionData);
        setCreatingSession(false);
      })
      .catch((error) => {
        console.error("Error creating new chat:", error);
        setCreatingSession(false);
      })
  };

  const handleDeleteSession = async (sessionDelete) => {
    try {
      const authSession = await fetchAuthSession();
      const { email } = await fetchUserAttributes();
      const token = authSession.tokens.idToken;
      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }user/delete_session?email=${encodeURIComponent(
          email
        )}&topic_id=${encodeURIComponent(
          sessionDelete.topic_id
        )}&session_id=${encodeURIComponent(sessionDelete.session_id)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );
      if (response.ok) {
        console.log("Logging deleted session end:", sessionDelete.session_id);
        createUserSessionEngagementLog(sessionDelete.session_id, "session end")
        setSessions((prevSessions) =>
          prevSessions.filter(
            (isession) => isession.session_id !== sessionDelete.session_id
          )
        );
        if (sessionDelete.session_id === session.session_id) {
          setPreviousSession(sessionDelete);
          setSession(null);
          setMessages([]);
        }
      } else {
        console.error("Failed to delete session:", response.statusText);
      }
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  const handleDeleteMessage = async () => {
    // remember to set is submitting true/false
    const authSession = await fetchAuthSession();
    const token = authSession.tokens.idToken
    try {
      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }user/delete_last_message?session_id=${encodeURIComponent(
          session.session_id
        )}`,
        {
          method: "DELETE",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        setMessages((prevMessages) => {
          if (prevMessages.length >= 2) {
            return prevMessages.slice(0, -2);
          } else {
            return [];
          }
        });
      } else {
        console.error("Failed to delete message:", response.statusText);
      }
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;

        // Enforce max-height and add scroll when needed
        if (textarea.scrollHeight > parseInt(textarea.style.maxHeight)) {
          textarea.style.overflowY = "auto";
        } else {
          textarea.style.overflowY = "hidden";
        }
      }
    };

    handleResize();
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.addEventListener("input", handleResize);

      textarea.addEventListener("keydown", handleKeyDown);
    }

    // Cleanup event listener on unmount
    return () => {
      if (textarea) {
        textarea.removeEventListener("input", handleResize);
        textarea.removeEventListener("keydown", handleKeyDown);
      }
    };
  }, [textareaRef.currrent, handleKeyDown]);

  const getMessages = async () => {
    try {
      const authSession = await fetchAuthSession();
      const token = authSession.tokens.idToken
      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }user/get_messages?session_id=${encodeURIComponent(
          session.session_id
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
        const data = await response.json();
        setMessages(data);
        setNewSessionCreated(false);
      } else {
        console.error("Failed to retreive messages:", response.statusText);
        setMessages([]);
        setNewSessionCreated(true);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      setMessages([]);
    }
  };

  const switchingSessions = (previousSession, currentSession) => {
    let userEmail;
    let authToken;
    return fetchAuthSession()
      .then((session) => {
        authToken = session.tokens.idToken
        return fetchUserAttributes();
      })
      .then(({ email }) => {
        userEmail = email;
        const prevSessionUrl = `${
          import.meta.env.VITE_API_ENDPOINT
        }user/create_user_session_engagement_log?email=${encodeURIComponent(
          userEmail
        )}&session_id=${encodeURIComponent(
          previousSession.session_id
        )}&engagement_type=${encodeURIComponent("session end")}`;

        const currentSessionUrl = `${
          import.meta.env.VITE_API_ENDPOINT
        }user/create_user_session_engagement_log?email=${encodeURIComponent(
          userEmail
        )}&session_id=${encodeURIComponent(
          currentSession.session_id
        )}&engagement_type=${encodeURIComponent("session start")}`;

        return Promise.all([
          fetch(prevSessionUrl, {
            method: "POST",
            headers: {
              Authorization: authToken,
              "Content-Type": "application/json",
            },
          }),
          fetch(currentSessionUrl, {
            method: "POST",
            headers: {
              Authorization: authToken,
              "Content-Type": "application/json",
            },
          }),
        ]);
      })
      .then(([response1, response2]) => {
        if (!response1.ok || !response2.ok) {
          throw new Error(`Failed to create user session engagement logs: ${response1.statusText}`);
        }
        setPreviousSession(currentSession);
        console.log("Switched sessions");
        return response1.json();
      })
      .catch((error) => {
        console.error("Error switching sessions", error);
      })
  };


  useEffect(() => {
    if (session) {
      console.log("Session Change:", session.session_id);
      if (previousSession) {
        console.log("Previous Session:", previousSession.session_id);
        if (session.session_id !== previousSession.session_id) {
          switchingSessions(previousSession, session);
        }
      } else {
        console.log("No previous session");
        createUserSessionEngagementLog(session.session_id, "session start")
        setPreviousSession(session);
      }
      getMessages();
    }
  }, [session]);

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
          <>
          {/* Sidebar */}
          <div
            className={`bg-gradient-to-tr from-[#00EEFF] to-[#2E8797] transition-all duration-500 ${
              isSidebarOpen ? "w-[25%]" : "w-16"
            } flex-shrink-0`}
          >
            {/* Top Section */}
            <div className="flex items-center justify-between p-4">
              {isSidebarOpen && (
                <Typography
                  sx={{
                    color: "#000000",
                    fontWeight: "bold",
                    fontSize: "4vh",
                  }}
                >
                 {name}
                </Typography>
              )}

              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="bg-transparent text-black focus:outline-none"
                style={{ border: "none", padding: 0 }}
              >
                {isSidebarOpen ? (
                  <GoSidebarExpand size={35} className="ml-2"/>
                ) : (
                  <GoSidebarCollapse size={35} />
                )}
              </button>
            </div>

            {/* New Chat Dropdown */}
            {isSidebarOpen && (
              <div className="relative mx-4 my-2">
                <div
                    className={`bg-transparent border border-black py-2 px-4 w-full font-roboto font-bold flex items-center justify-between text-[#212427] cursor-pointer transition-all duration-300 bg-opacity-80 hover:bg-[#212427] hover:text-white ${isOpen ? 'bg-[#212427] text-white rounded-t' : 'rounded'}`}
                    onMouseEnter={() => setIsOpen(true)} // Set to true on hover
                    onMouseLeave={() => setIsOpen(false)} // Set to false when not hovering
                >
                    New Chat
                    <FaChevronDown className="ml-2" />
                </div>
                <div className={`absolute left-0 top-full w-full z-50 bg-[#212427] bg-opacity-90 text-white overflow-hidden transition-all duration-100 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                      onMouseEnter={() => setIsOpen(true)} // Set to true on hover
                      onMouseLeave={() => setIsOpen(false)} // Set to false when not hovering
                >
                  {topics.length > 0 ? (
                    topics.map((topic, index) => (
                      <div
                        key={index}
                        className="px-4 py-2 hover:bg-gray-600 text-left cursor-pointer"
                        onClick={() => {
                          if (!creatingSession) {
                            setCreatingSession(true);
                            handleNewChat(topic);
                          }
                        }}
                      >
                        + {topic.topic_name}
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-2 text-left cursor-default">
                      No Topics Available
                    </div>
                  )}
                </div>
              </div>
            
            )}

            {/* Centered Box */}
            {isSidebarOpen && (
              <div className="flex justify-center my-4">
                <Box
                  sx={{
                    width: "90%",
                    height: "1px",
                    backgroundColor: "#212427",
                  }}
                />
              </div>
            )}

            {/* History Header */}
            {isSidebarOpen && (
              <Typography
                sx={{
                  color: "#212427",
                  fontWeight: "bold",
                  fontSize: "3vh",
                }}
                className="pl-4 text-left"
              >
                History
              </Typography>
            )}

            {/* Sessions List */}

            { sessions.length === 0 && isSidebarOpen && (
              <div className="flex-grow flex items-center justify-center">
                <Typography
                  sx={{ color: "#212427", fontSize: "2vh" }}
                >
                  No chat history
                </Typography>
              </div>
            ) }

            <div className="overflow-y-auto mt-2 mb-6">
              {isSidebarOpen &&
                sessions
                  .slice()
                  .reverse()
                  .map((iSession) => (
                    <Session
                      key={iSession.session_id}
                      text={iSession.session_name}
                      session={iSession}
                      setSession={setSession}
                      deleteSession={handleDeleteSession}
                      selectedSession={session}
                      setMessages={setMessages}
                      setSessions={setSessions}
                    />
                  ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-grow bg-[#F8F9FD] flex flex-col">
          <div className="w-full">
              <UserHeader admin={admin}/>
            </div>
              {!session ? (
                <div className="flex-grow bg-[#F8F9FD] flex items-center justify-center">
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 1, mt: -5 }}>
                    <Typography
                      sx={{ color: "#212427", fontWeight: "bold", textAlign: "center", mb: 1, fontSize: "5vh" }}
                    >
                      Welcome to Quantum AI
                    </Typography>
                    <Typography
                      sx={{ color: "#212427", textAlign: "center", mb: 5, fontSize: "4vh" }}
                    >
                      Click on a previous chat or make a new one to get started
                    </Typography>
                    <img src={logo} alt="Logo" style={{ height: "15vh", marginTop: "-2vh" }} />
                  </Box>
                </div>
              ) : (
                // Keep everything as is when the conditions are not met
                <div className="flex-grow flex flex-col h-[calc(100vh-5rem)]"> {/* Adjust 5rem based on your header height */}
                  {/* Messages */}
                <div className="flex-grow overflow-y-auto p-4">
                  {newSessionCreated ? (
                    <div className="flex items-center justify-center h-full">
                    <Typography
                      sx={{ 
                        color: "#212427", 
                        fontWeight: "bold", 
                        textAlign: "center", 
                        fontSize: "4vh",
                        transform: "translateY(-50%)" // This moves the text down by 25% of its container's height
                      }}
                    >
                      What can I help you with today?
                    </Typography>
                  </div>
                  ) : (
                    messages.map((message, index) =>
                      message.user_sent ? (
                        <UserMessage
                          key={message.message_id}
                          message={message.message_content}
                          isMostRecent={getMostRecentUserMessageIndex() === index}
                          onDelete={() => handleDeleteMessage()}
                          hasAiMessageAfter={hasAiMessageAfter(
                            messages,
                            getMostRecentUserMessageIndex()
                          )}
                        />
                      ) : (
                        <AIMessage key={message.message_id} message={message.message_content} />
                      )
                    )
                  )}
                  {isAItyping &&
                    currentSessionId &&
                    session?.session_id &&
                    currentSessionId === session.session_id && <TypingIndicator />}
                  <div ref={messagesEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="flex rounded items-center justify-between border bg-[#f2f0f0] border-[#8C8C8C] py-1 mb-4 mt-4 mx-20">
                    <textarea
                      ref={textareaRef}
                      className="text-sm w-full outline-none bg-[#f2f0f0] text-black resize-none max-h-32 mx-2"
                      style={{ maxHeight: "8rem" }}
                      placeholder="Enter Message Here..."
                      maxLength={2096}
                    />
                    <IoSend
                      onClick={handleSubmit}
                      className="cursor-pointer w-5 h-5 mr-4 text-[#2E8797]"
                    />
                  </div>
                </div>
              )}
          </div>
          </>
        )}
    </div>
  );
};

export default UserChat;