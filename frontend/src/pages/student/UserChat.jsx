import { useEffect, useRef, useState } from "react";
import AIMessage from "../../components/AIMessage";
import Session from "../../components/Session";
import StudentMessage from "../../components/StudentMessage";
import { fetchAuthSession } from "aws-amplify/auth";
import { useNavigate } from "react-router-dom";
import { fetchUserAttributes } from "aws-amplify/auth";

const TypingIndicator = () => (
  <div className="flex items-center ml-28 mb-4">
    <div className="flex space-x-1">
      <div
        className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
        style={{ animationDelay: "0s" }}
      ></div>
      <div
        className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
        style={{ animationDelay: "0.2s" }}
      ></div>
      <div
        className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
        style={{ animationDelay: "0.4s" }}
      ></div>
    </div>
    <span className="ml-2 text-gray-500">AI is typing...</span>
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

const UserChat = ({ admin, course, module, setModule, setCourse }) => {
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [newMessage, setNewMessage] = useState(null);
  const [isAItyping, setIsAItyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (
      !loading &&
      !creatingSession &&
      !isSubmitting &&
      !isAItyping &&
      sessions.length === 0
    ) {
      handleNewChat();
    }
  }, [sessions, creatingSession]);

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
    const fetchModule = async () => {
      setLoading(true);
      if (!course || !module) {
        return;
      }

      try {
        const session = await fetchAuthSession();
        const { email } = await fetchUserAttributes();
        const token = session.tokens.idToken
        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }student/module?email=${encodeURIComponent(
            email
          )}&course_id=${encodeURIComponent(
            course.course_id
          )}&module_id=${encodeURIComponent(module.module_id)}`,
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
          console.error("Failed to fetch module:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching module:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchModule();
  }, [course, module]);

  const getMostRecentStudentMessageIndex = () => {
    const studentMessages = messages
      .map((message, index) => ({ ...message, index }))
      .filter((message) => message.student_sent);
    return studentMessages.length > 0
      ? studentMessages[studentMessages.length - 1].index
      : -1;
  };

  const hasAiMessageAfter = (messages, recentStudentMessageIndex) => {
    return messages
      .slice(recentStudentMessageIndex + 1)
      .some((message) => !message.student_sent);
  };

  async function retrieveKnowledgeBase(message, sessionId) {
    try {
      const authSession = await fetchAuthSession();
      const { email } = await fetchUserAttributes();
      const token = authSession.tokens.idToken
      try {
        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }student/create_ai_message?session_id=${encodeURIComponent(
            sessionId
          )}&email=${encodeURIComponent(email)}&course_id=${encodeURIComponent(
            course.course_id
          )}&module_id=${encodeURIComponent(module.module_id)}`,
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
        }student/create_message?session_id=${encodeURIComponent(
          newSession.session_id
        )}&email=${encodeURIComponent(
          userEmail
        )}&course_id=${encodeURIComponent(
          course.course_id
        )}&module_id=${encodeURIComponent(module.module_id)}`;

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
        setIsAItyping(true);
        textareaRef.current.value = "";

        const message = messageData[0].message_content;

        const textGenUrl = `${
          import.meta.env.VITE_API_ENDPOINT
        }student/text_generation?course_id=${encodeURIComponent(
          course.course_id
        )}&session_id=${encodeURIComponent(
          newSession.session_id
        )}&module_id=${encodeURIComponent(
          module.module_id
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
        }student/update_session_name?session_id=${encodeURIComponent(
          newSession.session_id
        )}`;

        setSessions((prevSessions) => {
          return prevSessions.map((s) =>
            s.session_id === newSession.session_id
              ? { ...s, session_name: titleCase(textGenData.session_name) }
              : s
          );
        });

        const updateModuleScore = `${
          import.meta.env.VITE_API_ENDPOINT
        }student/update_module_score?module_id=${encodeURIComponent(
          module.module_id
        )}&student_email=${encodeURIComponent(
          userEmail
        )}&course_id=${encodeURIComponent(
          course.course_id
        )}&llm_verdict=${encodeURIComponent(textGenData.llm_verdict)}`;

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
          fetch(updateModuleScore, {
            method: "POST",
            headers: {
              Authorization: authToken,
              "Content-Type": "application/json",
            },
          }),
          textGenData,
        ]);
      })
      .then(([response1, response2, textGenData]) => {
        if (!response1.ok || !response2.ok) {
          throw new Error("Failed to fetch endpoints");
        }

        return retrieveKnowledgeBase(
          textGenData.llm_output,
          newSession.session_id
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

  const handleBack = () => {
    sessionStorage.removeItem("module");
    navigate(-1);
  };

  const handleNewChat = () => {
    let sessionData;
    let userEmail;
    let authToken;
    setIsAItyping(true);
    return fetchAuthSession()
      .then((session) => {
        authToken = session.tokens.idToken
        return fetchUserAttributes();
      })
      .then(({ email }) => {
        userEmail = email;
        const session_name = "New chat";
        const url = `${
          import.meta.env.VITE_API_ENDPOINT
        }student/create_session?email=${encodeURIComponent(
          userEmail
        )}&course_id=${encodeURIComponent(
          course.course_id
        )}&module_id=${encodeURIComponent(
          module.module_id
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
        setSession(sessionData);
        setCreatingSession(false);

        const textGenUrl = `${
          import.meta.env.VITE_API_ENDPOINT
        }student/text_generation?course_id=${encodeURIComponent(
          course.course_id
        )}&session_id=${encodeURIComponent(
          sessionData.session_id
        )}&module_id=${encodeURIComponent(
          module.module_id
        )}&session_name=${encodeURIComponent("New chat")}`;

        return fetch(textGenUrl, {
          method: "POST",
          headers: {
            Authorization: authToken,
            "Content-Type": "application/json",
          },
        });
      })
      .then((textResponse) => {
        if (!textResponse.ok) {
          throw new Error(
            `Failed to create initial message: ${textResponse.statusText}`
          );
        }
        return textResponse.json();
      })
      .then((textResponseData) => {
        retrieveKnowledgeBase(
          textResponseData.llm_output,
          sessionData.session_id
        );
        return sessionData;
      })
      .catch((error) => {
        console.error("Error creating new chat:", error);
        setCreatingSession(false);
        setIsAItyping(false);
      })
      .finally(() => {
        setIsAItyping(false);
      });
  };

  const handleDeleteSession = async (sessionDelete) => {
    try {
      const authSession = await fetchAuthSession();
      const { email } = await fetchUserAttributes();
      const token = authSession.tokens.idToken
      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }student/delete_session?email=${encodeURIComponent(
          email
        )}&course_id=${encodeURIComponent(
          course.course_id
        )}&module_id=${encodeURIComponent(
          module.module_id
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
        const data = await response.json();
        setSessions((prevSessions) =>
          prevSessions.filter(
            (isession) => isession.session_id !== sessionDelete.session_id
          )
        );
        if (sessionDelete.session_id === session.session_id) {
          setSession(null);
          setMessages([]);
        }
      } else {
        console.error("Failed to create session:", response.statusText);
      }
    } catch (error) {
      console.error("Error creating session:", error);
    }
  };

  const handleDeleteMessage = async (message) => {
    // remember to set is submitting true/false
    const authSession = await fetchAuthSession();
    const { email } = await fetchUserAttributes();
    const token = authSession.tokens.idToken
    try {
      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }student/delete_last_message?session_id=${encodeURIComponent(
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
        const data = await response.json();
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
  useEffect(() => {
    const storedModule = sessionStorage.getItem("module");
    if (storedModule) {
      setModule(JSON.parse(storedModule));
    }
  }, [setModule]);

  useEffect(() => {
    const storedCourse = sessionStorage.getItem("course");
    if (storedCourse) {
      setCourse(JSON.parse(storedCourse));
    }
  }, [setCourse]);

  const getMessages = async () => {
    try {
      const authSession = await fetchAuthSession();
      const { email } = await fetchUserAttributes();
      const token = authSession.tokens.idToken
      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }student/get_messages?session_id=${encodeURIComponent(
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
      } else {
        console.error("Failed to retreive session:", response.statusText);
        setMessages([]);
      }
    } catch (error) {
      console.error("Error fetching session:", error);
      setMessages([]);
    }
  };
  useEffect(() => {
    if (session) {
      getMessages();
    }
  }, [session]);

  if (!module) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-row h-screen">
      <div className="flex flex-col w-1/4 bg-gradient-to-tr from-purple-300 to-cyan-100">
        <div className="flex flex-row mt-3 mb-3 ml-4">
          <img
            onClick={() => handleBack()}
            className="w-8 h-8 cursor-pointer"
            src="./ArrowCircleDownRounded.png"
            alt="back"
          />
          <div className="ml-3 pt-0.5 text-black font-roboto font-bold text-lg">
            {titleCase(module.module_name)}
          </div>
        </div>
        <button
          onClick={() => {
            if (!creatingSession) {
              setCreatingSession(true);
              handleNewChat();
            }
          }}
          className="border border-black ml-8 mr-8 mt-0 mb-0 bg-transparent pt-1.5 pb-1.5"
        >
          <div className="flex flex-row gap-6">
            <div className="text-md font-roboto text-[#212427]">+</div>
            <div className="text-md font-roboto font-bold text-[#212427]">
              New Chat
            </div>
          </div>
        </button>
        <div className="my-4">
          <hr className="border-t border-black" />
        </div>
        <div className="font-roboto font-bold ml-8 text-start text-[#212427]">
          History
        </div>
        <div className=" overflow-y-auto mt-2 mb-6">
          {sessions
            .slice()
            .reverse()
            .map((iSession, index) => (
              <Session
                key={iSession.session_id}
                text={iSession.session_name}
                session={iSession}
                setSession={setSession}
                deleteSession={handleDeleteSession}
                selectedSession={session}
                setMessages={setMessages}
                setSessions={setSessions}
                sessions={sessions}
              />
            ))}
        </div>
      </div>
      <div className="flex flex-col-reverse w-3/4 bg-[#F8F9FD]">
        <div className="flex items-center justify-between border bg-[#f2f0f0] border-[#8C8C8C] py-2 mb-12 mx-20">
          <textarea
            ref={textareaRef}
            className="text-sm w-full outline-none bg-[#f2f0f0] text-black resize-none max-h-32 ml-2 mr-2"
            style={{ maxHeight: "8rem" }}
            maxLength={2096}
          />
          <img
            onClick={handleSubmit}
            className="cursor-pointer w-3 h-3 mr-4"
            src="./send.png"
            alt="send"
          />
        </div>
        <div className="flex-grow overflow-y-auto p-4 h-full">
          {messages.map((message, index) =>
            message.student_sent ? (
              <StudentMessage
                key={message.message_id}
                message={message.message_content}
                isMostRecent={getMostRecentStudentMessageIndex() === index}
                onDelete={() => handleDeleteMessage(message)}
                hasAiMessageAfter={hasAiMessageAfter(
                  messages,
                  getMostRecentStudentMessageIndex()
                )}
              />
            ) : (
              <AIMessage
                key={message.message_id}
                message={message.message_content}
              />
            )
          )}
          {isAItyping &&
            currentSessionId &&
            session?.session_id &&
            currentSessionId === session.session_id && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
        <div className="font-roboto font-bold text-2xl text-left mt-6 ml-12 mb-6 text-black">
          AI Assistant 🌟
        </div>
      </div>
    </div>
  );
};

export default UserChat;
