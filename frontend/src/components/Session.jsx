import { useEffect, useState, useRef } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
const Session = ({
  text,
  session,
  setSession,
  deleteSession,
  selectedSession,
  setMessages,
  setSessions,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newSessionName, setNewSessionName] = useState(text);
  const [deleting, setDeleting] = useState(false);

  const sessionRef = useRef(null);

  // Handle clicks outside the session component
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sessionRef.current && !sessionRef.current.contains(event.target)) {
        handleInputBlur(); // Save changes when clicking outside
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleInputBlur();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [newSessionName]);

  const isSelected =
    selectedSession && selectedSession.session_id === session.session_id;

  const handleSessionClick = () => {
    if (selectedSession && selectedSession.session_id !== session.session_id) {
      setMessages([]);
    }
    setSession(session);
  };

  const handleDeleteClick = (event) => {
    setDeleting(true);
    event.stopPropagation();
    deleteSession(session);
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleInputChange = (event) => {
    const inputValue = event.target.value;
    if (inputValue.length <= 20) {
      setNewSessionName(inputValue);
    }
  };

  const handleInputBlur = async () => {
    setIsEditing(false);
    if (newSessionName !== text) {
      // Update the session name in the parent component or backend
      updateSessionName(session.session_id, newSessionName).catch((err) => {
        console.error("Failed to update session name:", err);
      });
    }
  };

  const updateSessionName = (sessionId, newName) => {
    const updatedName = newName.trim() === "" ? "New Chat" : newName;

    // Update the sessions state first
    setSessions((prevSessions) =>
      prevSessions.map((session) =>
        session.session_id === sessionId
          ? { ...session, session_name: updatedName }
          : session
      )
    );

    // Return the fetchAuthSession promise
    return fetchAuthSession()
      .then((authSession) => {
        const token = authSession.tokens.idToken
        // Return the fetch promise
        return fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }user/update_session_name?session_id=${encodeURIComponent(
            sessionId
          )}`,
          {
            method: "PUT",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ session_name: updatedName }),
          }
        );
      })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to update session name");
        }
      })
      .catch((error) => {
        console.error("Error updating session name:", error);
      });
  };

  return (
    <div
      onClick={handleSessionClick}
      style={{
        background: "#1E1818",
      }}
      className={`cursor-pointer rounded flex flex-row justify-between items-center my-2 mx-4 py-2 px-4 ${
        !isSelected ? "opacity-80" : ""
      }`}
    >

      <div
        onDoubleClick={handleDoubleClick}
        className="flex flex-row items-center justify-start gap-6"
      >
        <img src="/message.png" alt="message" className="w-3 h-3" />
        {isEditing ? (
          <input
            type="text"
            value={newSessionName}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            autoFocus
            className="text-[#212427] pl-1 font-light font-inter bg-white text-xs border-none outline-none"
          />
        ) : (
          <div className="text-[#e8e8e8] font-light font-inter text-xs">
            {deleting ? "Deleting chat..." : text}
          </div>
        )}
      </div>
      <div
        onClick={handleDeleteClick}
        className="cursor-pointer w-3 h-3 flex items-center justify-center ml-2"
        style={{ marginLeft: "8px" }}
      >
        <img src="/delete.png" alt="delete" className="w-3 h-3 transform transition-transform duration-50 hover:scale-125" />
      </div>
    </div>
  );
};

export default Session;
